import React, { useState } from 'react';
import axios from 'axios';

export const Ai = () => {
  const [response, setResponse] = useState('');
  const [budget, setBudget] = useState('');
  const [loading, setLoading] = useState(false); 

  const ask = async (action) => {
    try {
      setLoading(true); 
      setResponse('');  

      const payload = { action };
      if (action === 'buy') payload.budget = Number(budget);

      const res = await axios.post("/aisuggest", payload);
      setResponse(res.data.answer || "No response");
      console.log("Backend answer:", res.data.answer);
    } catch (error) {
      console.error("Error calling backend:", error);
      setResponse("Something went wrong.");
    } finally {
      setLoading(false); 
    }
  };

  return (
    <div className="text-white p-4">
      <h2 className="mb-4 text-xl font-bold">AI Stock Suggestions</h2>

      
      <div className="mb-4">
        <label className="block mb-1">Investment Amount (₹)</label>
        <input
          type="number"
          min="0"
          value={budget}
          onChange={(e) => setBudget(e.target.value)}
          className="text-black p-2 rounded w-full"
          placeholder="e.g. 50000"
        />
      </div>

      <div className="flex flex-col gap-3 mb-6">
        <button
          onClick={() => ask('buy')}
          className="bg-blue-500 px-4 py-2 rounded disabled:opacity-50"
          disabled={!budget || Number(budget) <= 0 || loading}
        >
          Best stocks to buy
        </button>

        <button
          onClick={() => ask('sell')}
          className="bg-green-500 px-4 py-2 rounded"
          disabled={loading}
        >
          What stocks to sell (from portfolio)
        </button>

        <button
          onClick={() => ask('sectors')}
          className="bg-purple-500 px-4 py-2 rounded"
          disabled={loading}
        >
          Top 5 sectors to invest in
        </button>
      </div>

      {loading ? (
        <div className="mt-4 p-3 bg-gray-800 rounded animate-pulse">
          Loading...
        </div>
      ) : response && (
        <pre className="mt-4 p-3 bg-gray-800 rounded whitespace-pre-wrap">
          {response}
          <br/>
          <br/>
          <div className='text-red-600'>* It is important to remember this are AI suggestions and should not be treated as financial advises. Do you own research befor taking any decision. </div>
        </pre>
      )}
    </div>
  );
};
