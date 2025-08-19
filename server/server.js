require('dotenv').config();
require('./config/connection');
const express = require('express');
const User = require('./models/user');
const get_token = require('./JWT/gentoken');
const cookie_parser = require('cookie-parser');
const Portfolio = require('./models/stocks');
const isloggedin = require('./middleware/isloggedin');
const axios = require("axios");
const fs = require('fs');
const path = require('path');
const order = require('./middleware/order');

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(cookie_parser());
app.use(express.json());

app.post('/signin', async (req, res) => {
  const { email, name } = req.body;

  try {
    let myuser = await User.findOne({ email });

    if (!myuser) {
      myuser = await User.create({ name, email });
      const portF = await Portfolio.create({ user: myuser._id });
      myuser.stocks = portF._id;
      await myuser.save();
      const token = get_token(myuser);
      res.status(200).cookie('token', token).json({ message: "User verified", name, fund: myuser.current_funds });
    } else {
      const token = get_token(myuser);
      res.status(200).cookie('token', token).json({ message: "User verified", name: myuser.name, fund: myuser.current_funds });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

app.get('/logout', isloggedin, (req, res) => {
  res.clearCookie('token');
  return res.status(200).send('Logged out successfully');
});

app.post('/editfunds', isloggedin, async (req, res) => {
  const user = req.user;
  try {
    await user.updateOne({ current_funds: req.body.fund });
    return res.status(200).json({ message: "Funds updated " });
  } catch (err) {
    console.log(err);
  }
});

app.post('/orderbuy', isloggedin, order, async (req, res) => {
  const { action, quantity } = req.body.data;
  const stock = req.body.stock;
  const myuser = req.user;

  const parsedQuantity = parseInt(quantity);
  const parsedPrice = parseFloat(req.body.price);

  if (isNaN(parsedQuantity) || isNaN(parsedPrice)) {
    return res.status(400).json({ message: "Invalid quantity or price format" });
  }

  const cost = parsedPrice * parsedQuantity;

  try {
    if (action.toLowerCase() === "buy") {
      if (myuser.current_funds < cost) {
        return res.status(201).json({ message: "You do not have sufficient funds (gareeb he tu)" });
      }

      myuser.current_funds -= cost;
      await myuser.save();

      let portfolio = await Portfolio.findOne({ user: myuser._id });

      const existingStock = portfolio.stocks.find(s => s.company === stock);

      if (existingStock) {
        const totalCost = existingStock.average_price * existingStock.quantity + cost;
        const totalQty = existingStock.quantity + parsedQuantity;
        existingStock.average_price = parseFloat((totalCost / totalQty).toFixed(2));
        existingStock.quantity = totalQty;
      } else {
        portfolio.stocks.push({
          company: stock,
          average_price: parsedPrice,
          quantity: parsedQuantity
        });
      }

      await portfolio.save();

      myuser.netInvestment += cost;
      await myuser.save();
      return res.status(200).json({ message: "Order executed successfully." });
    }

    return res.status(400).json({ message: "Only BUY action is supported for now." });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.post('/ordersell', isloggedin, order, async (req, res) => {
  const { quantity } = req.body.data;
  const stock = req.body.stock;
  const price = parseFloat(req.body.price);
  const myuser = req.user;

  const parsedQuantity = parseInt(quantity);

  if (isNaN(parsedQuantity) || parsedQuantity <= 0 || isNaN(price)) {
    return res.status(400).json({ message: "Invalid quantity or price format" });
  }

  try {
    const portfolio = await Portfolio.findOne({ user: myuser._id });

    if (!portfolio) {
      return res.status(400).json({ message: `You do not hold any stocks to sell.` });
    }

    const existingStock = portfolio.stocks.find(s => s.company === stock);

    if (!existingStock) {
      return res.status(201).json({ message: `You do not own any shares of ${stock}.` });
    }

    if (existingStock.quantity < parsedQuantity) {
      return res.status(201).json({ message: `Insufficient shares to sell. You only have ${existingStock.quantity}.` });
    }

    existingStock.quantity -= parsedQuantity;

    if (existingStock.quantity === 0) {
      portfolio.stocks = portfolio.stocks.filter(s => s.company !== stock);
    }

    const credit = price * parsedQuantity;
    const realisedProfit = (price - existingStock.average_price) * parsedQuantity;
    myuser.realisedPL += realisedProfit;
    myuser.current_funds += credit;

    await myuser.save();
    await portfolio.save();

    return res.status(200).json({
      message: `Successfully sold ${parsedQuantity} shares of ${stock} for ₹${credit.toFixed(2)}.`,
      updatedFunds: myuser.current_funds
    });
  } catch (err) {
    console.error("Sell error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.get('/getstocks', isloggedin, async (req, res) => {
  const myuser = req.user;
  try {
    const portfolio = await Portfolio.findOne({ user: myuser._id });
    if (!portfolio) return res.status(200).json({ stocks: [] });

    res.status(200).json({ stocks: portfolio.stocks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch portfolio" });
  }
});

app.post("/aisuggest", isloggedin, async (req, res) => {
  try {
    const { action, budget } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Missing 'action' in body" });
    }

    const styleGuide = `
Return ONLY the list lines as requested. No intro, no bullets, no disclaimers.
Limit adjectives. Keep each line terse.
    `.trim();

    let prompt = "";

    if (action === "buy") {
      if (!budget || Number(budget) <= 0) {
        return res.status(400).json({ error: "Valid 'budget' is required for action=buy" });
      }

      prompt = `
You are an investing assistant for Indian equities/ETFs.
Task: Suggest a compact plan for ₹${budget}.
${styleGuide}

Output exactly 5 lines. Format per line:
Name | Sector | Allocation%

Allocations must sum to 100%.
Do not include prices or explanations beyond the format.
      `.trim();
    } else if (action === "sell") {
      let portfolioSummary = "None";
      if (req.user && req.user._id) {
        const portfolio = await Portfolio.findOne({ user: req.user._id }).lean();
        if (portfolio && Array.isArray(portfolio.stocks) && portfolio.stocks.length) {
          portfolioSummary = portfolio.stocks
            .map(s => `${s.company} | Qty:${s.quantity} | Avg₹:${s.average_price}`)
            .join("\n");
        }
      }

      if (portfolioSummary === "None") {
        return res.json({ answer: "No saved portfolio found." });
      }

      prompt = `
You are an investing assistant for Indian equities.
Task: From the portfolio, identify up to 5 positions to SELL or TRIM.
${styleGuide}

Portfolio:
${portfolioSummary}

Output up to 5 lines. Format per line:
Company | Action(SELL/TRIM/HOLD) | Reason(<=6 words)
      `.trim();
    } else if (action === "sectors") {
      prompt = `
You are an investing assistant for Indian markets.
Task: List top 5 sectors to focus on right now.
${styleGuide}

Output exactly 5 lines.
Format per line:
Sector | 1–2 reasons(<=6 words) | Example Company

Example Company must be an actual large-cap or mid-cap Indian stock from that sector.
No intro, no outro, no extra commentary.
  `.trim();
    } else {
      return res.status(400).json({ error: "Invalid 'action'. Use 'buy' | 'sell' | 'sectors'." });
    }

    const aiRes = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        contents: [
          { role: "user", parts: [{ text: prompt }] }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY,
        },
        timeout: 20000
      }
    );

    const answer =
      aiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      "No response";

    return res.json({ answer });
  } catch (err) {
    console.error("Error in /aisuggest:", err.response?.data || err.message);
    return res.status(500).json({
      error: "Internal Server Error",
      details: err.response?.data || err.message,
    });
  }
});

app.get('/userdata', isloggedin, async (req, res) => {
  const myuser = req.user;
  return res.status(200).json({ investment: myuser.netInvestment, PL: myuser.realisedPL });
});

// ---------- Serve React frontend in production ----------
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../client/build");
  app.use(express.static(clientBuildPath));

  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}
// --------------------------------------------------------

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
