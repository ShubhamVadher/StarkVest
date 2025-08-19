import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';

const API_KEY = process.env.REACT_APP_STOCK_API_KEY;

export const Portfolio = () => {
  const [stocks, setStocks] = useState([]);
  const [activeTrade, setActiveTrade] = useState(null);
  const [tradeQuantity, setTradeQuantity] = useState('');
  const [selectedExchange, setSelectedExchange] = useState({});
  const [livePrices, setLivePrices] = useState({});
  const [unrealisedPL, setUnrealisedPL] = useState(0);

  const isMounted = useRef(true); // prevent state updates after unmount

  // Fetch portfolio
  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();

    const fetchPortfolio = async () => {
      try {
        const res = await axios.get('/getstocks', { signal: controller.signal });
        if (res.status === 200 && isMounted.current) {
          setStocks(res.data.stocks || []);
        }
      } catch (err) {
        if (err.name !== "CanceledError" && err.name !== "AbortError") {
          console.error("Failed to load portfolio:", err);
        }
      }
    };
    fetchPortfolio();

    return () => {
      isMounted.current = false;
      controller.abort();
    };
  }, []);

  // Clean company name for API
  const cleanCompanyName = (name) => {
    let cleaned = name.toLowerCase();
    const patternsToRemove = [
      /\s+ltd\.?$/, /\s+limited$/, /\s+pvt\.?\s+ltd\.?$/, /\s+private\s+limited$/, /\s+llc$/,
      /\s+inc\.?$/, /\s+corporation$/, /\s+corp\.?$/, /\s+plc$/, /\s+co\.?$/, /\s+company$/
    ];
    patternsToRemove.forEach(pattern => cleaned = cleaned.replace(pattern, ''));
    return cleaned.trim();
  };

  // Fetch NSE/BSE prices
  const fetchLivePrice = async (company) => {
    const cleaned = cleanCompanyName(company);
    const controller = new AbortController();

    try {
      const res = await axios.get(
        `https://stock.indianapi.in/stock?name=${encodeURIComponent(cleaned)}`,
        {
          headers: { 'x-api-key': API_KEY },
          signal: controller.signal
        }
      );
      if (!res.data.error && isMounted.current) {
        setLivePrices(prev => ({
          ...prev,
          [company]: {
            NSE: res.data.currentPrice?.NSE,
            BSE: res.data.currentPrice?.BSE
          }
        }));
        setSelectedExchange(prev => ({ ...prev, [company]: 'NSE' }));
      }
    } catch (err) {
      if (err.name !== "CanceledError" && err.name !== "AbortError") {
        console.error(`Live price fetch failed for ${company}:`, err);
      }
    }

    return () => controller.abort();
  };

  // Calculate unrealised P/L whenever prices, stocks, or exchange selection change
  useEffect(() => {
    let total = 0;
    stocks.forEach(stock => {
      const live = livePrices[stock.company];
      const exchange = selectedExchange[stock.company] || 'NSE';
      const livePrice = live?.[exchange];

      if (livePrice) {
        const pl = (livePrice - stock.average_price) * stock.quantity;
        total += pl;
      }
    });
    if (isMounted.current) setUnrealisedPL(total);
  }, [livePrices, stocks, selectedExchange]);

  const handleBuySell = async (type, company) => {
    const quantity = parseInt(tradeQuantity);
    const exchange = selectedExchange[company];
    const price = livePrices[company]?.[exchange];

    if (!quantity || !price || quantity <= 0) return alert("Enter valid quantity and wait for price.");

    const con = window.confirm(`Are you sure you want to ${type} ${quantity} stocks of ${company}?`);
    if (!con) return;

    try {
      if (type === "buy") {
        const res = await axios.post('/orderbuy', {
          data: { action: 'buy', quantity },
          stock: company,
          price,
        });
        alert(res.data.message);
      } else {
        const res = await axios.post('/ordersell', {
          data: { quantity },
          stock: company,
          price,
        });
        alert(res.data.message);
      }
      window.location.reload();
    } catch (err) {
      alert("Trade failed");
      console.error(err);
    }
  };

  return (
    <div className="text-white">
      <h2 className="text-xl font-bold mb-1">Your Portfolio</h2>
      <p className="text-lg mb-4">
        Unrealised P/L:
        <span className={unrealisedPL >= 0 ? "text-green-400 ml-2" : "text-red-400 ml-2"}>
          ₹{unrealisedPL.toFixed(2)}
        </span>
      </p>

      {stocks.length === 0 ? (
        <p>No stocks to show</p>
      ) : (
        stocks.map(stock => {
          const live = livePrices[stock.company] || {};
          const isActive = activeTrade === stock.company;

          if (!live.NSE && !live.BSE) fetchLivePrice(stock.company);

          return (
            <div key={stock.company} className="border-b border-gray-600 mb-4 pb-2">
              <div><strong>Company:</strong> {stock.company}</div>
              <div><strong>Average Buy Price:</strong> ₹{stock.average_price}</div>
              <div><strong>Quantity:</strong> {stock.quantity}</div>
              <div>
                <strong>Live Price:</strong>
                <span className="ml-2">NSE: {live.NSE ?? 'Loading...'}</span> |
                <span className="ml-2">BSE: {live.BSE ?? 'Loading...'}</span>
              </div>

              {!isActive ? (
                <button
                  className="mt-2 bg-blue-500 text-white px-3 py-1 rounded"
                  onClick={() => setActiveTrade(stock.company)}
                >
                  BUY/SELL
                </button>
              ) : (
                <div className="mt-2">
                  <input
                    type="number"
                    placeholder="Enter quantity"
                    value={tradeQuantity}
                    onChange={(e) => setTradeQuantity(e.target.value)}
                    className="text-black p-1 mr-2"
                  />

                  <select
                    className="text-black mr-2 p-1"
                    value={selectedExchange[stock.company]}
                    onChange={(e) =>
                      setSelectedExchange((prev) => ({
                        ...prev,
                        [stock.company]: e.target.value,
                      }))
                    }
                  >
                    <option value="NSE">NSE</option>
                    <option value="BSE">BSE</option>
                  </select>

                  <button
                    className="bg-green-600 px-3 py-1 rounded mr-2"
                    onClick={() => handleBuySell("buy", stock.company)}
                  >
                    Buy
                  </button>
                  <button
                    className="bg-red-600 px-3 py-1 rounded"
                    onClick={() => handleBuySell("sell", stock.company)}
                  >
                    Sell
                  </button>
                  <button
                    className="ml-3 text-sm text-gray-400 underline"
                    onClick={() => {
                      setActiveTrade(null);
                      setTradeQuantity('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
