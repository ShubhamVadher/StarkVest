import axios from 'axios';
import React from 'react';
import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import './Details.css';

export const Details = () => {
  const { setFund } = useUser();
  const location = useLocation();
  const stockData = location.state?.stockData;

  const [tradeForm, setTradeForm] = useState({
    action: "buy",
    exchange: "NSE",
    quantity: 0,
  });

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setTradeForm(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (!stockData) return <p className='text-white'>No stock data found.</p>;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (tradeForm.quantity <= 0) {
      window.alert("Please enter a valid quantity for Stocks you want to BUY/SELL");
      return;
    }
    const con = window.confirm(`Are you sure you want to ${tradeForm.action} ${tradeForm.quantity} stocks of ${stockData.companyName}`);
    if (con) {
      try {
        const price = parseFloat(
          tradeForm.exchange === "NSE"
            ? stockData.currentPrice.NSE
            : stockData.currentPrice.BSE
        );

        if (tradeForm.action === "buy") {
          const response = await axios.post('/orderbuy', { data: tradeForm, stock: stockData.companyName, price });
          if (response.status === 200) {
            window.alert(response.data.message);
            const quantity = parseInt(tradeForm.quantity, 10);
            if (!isNaN(price) && !isNaN(quantity)) {
              const cost = price * quantity;
              setFund(prev => Number(prev) - cost);
            }
          } else {
            window.alert(response.data.message);
          }
        } else {
          const response = await axios.post('/ordersell', { data: tradeForm, stock: stockData.companyName, price });
          if (response.status === 200) {
            window.alert(response.data.message);
            const quantity = parseInt(tradeForm.quantity, 10);
            if (!isNaN(price) && !isNaN(quantity)) {
              const cost = price * quantity;
              setFund(prev => Number(prev) + cost);
            }
          } else {
            window.alert(response.data.message);
          }
        }
      } catch (err) {
        console.log(err);
      }
    }
  };

  const normalize = str =>
    str?.toLowerCase().replace(/\bltd\b|\blimited\b|\./g, '').trim();

  const baseName = normalize(stockData.companyName);

  const peerSelf = stockData.companyProfile?.peerCompanyList?.find(peer =>
    normalize(peer.companyName).includes(baseName)
  );

  const marketCap = peerSelf?.marketCap;
  const peRatio = peerSelf?.priceToEarningsValueRatio;

  const incomeData = stockData.financials?.[0]?.stockFinancialMap?.INC || [];
  const netIncome = parseFloat(
    incomeData.find(item => item.key === "NetIncome")?.value
  );
  const shares = parseFloat(
    incomeData.find(item => item.key === "DilutedWeightedAverageShares")?.value
  );
  const eps = netIncome && shares ? (netIncome / shares).toFixed(2) : null;
  const navigate = useNavigate;

  return (
    <div className='details-page'>
      <h2 className='details-title'>{stockData.companyName}</h2>
      <p><strong>Industry:</strong> {stockData.industry}</p>

      <h3 className='section-title'>Stock Prices</h3>
      <p><strong>BSE:</strong> ₹{stockData.currentPrice?.BSE}</p>
      <p><strong>NSE:</strong> ₹{stockData.currentPrice?.NSE}</p>
      <p><strong>52 Week High:</strong> ₹{stockData.yearHigh}</p>
      <p><strong>52 Week Low:</strong> ₹{stockData.yearLow}</p>
      <p><strong>Percent Change:</strong> {stockData.percentChange}%</p>

      <h3 className='section-title'>Financial Info</h3>
      <p><strong>Market Cap:</strong> ₹{marketCap ?? "N/A"}</p>
      <p><strong>PE Ratio:</strong> {peRatio ?? "N/A"}</p>
      <p><strong>EPS:</strong> ₹{eps ?? "N/A"}</p>

      <h3 className='section-title'>Company Description</h3>
      <p>{stockData.companyProfile?.companyDescription}</p>
      <form className="trade-form" onSubmit={handleSubmit}>
        <div className='form-group'>
          <label className="trade-action-label">
            <input
              type="radio"
              name="action"
              value="buy"
              checked={tradeForm.action === "buy"}
              onChange={handleFormChange}
              className="mr-1"
            />
            Buy
          </label>
          <label className="trade-action-label">
            <input
              type="radio"
              name="action"
              value="sell"
              checked={tradeForm.action === "sell"}
              onChange={handleFormChange}
              className="mr-1"
            />
            Sell
          </label>
        </div>

        <div className='form-group'>
          <label htmlFor="exchange" className="trade-label">Select Exchange:</label>
          <select
            name="exchange"
            id="exchange"
            value={tradeForm.exchange}
            onChange={handleFormChange}
            className="trade-label"
          >
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </div>

        <div className='form-group'>
          <label htmlFor="quantity" className='trade-label'>Quantity:</label>
          <input
            type="number"
            className='trade-input'
            name="quantity"
            id="quantity"
            value={tradeForm.quantity}
            required
            onChange={handleFormChange}
            min="1"
          />
        </div>

        <button type="submit" className="trade-submit-button">
          Submit
        </button>
      </form>
    </div>
  );
};
