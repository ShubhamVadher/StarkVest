import React, { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import { useUser } from '../context/UserContext';
import "./Navbar.css";

const API_KEY = process.env.REACT_APP_STOCK_API_KEY;

export const Navbar = () => {
  const { loginWithRedirect, logout, user, isAuthenticated } = useAuth0();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayname, setdisplayname] = useState("");
  const { fund, setFund } = useUser();

  const [formdata, setformdata] = useState({ funds: 0, company: "" });
  const [suggestions, setSuggestions] = useState([]);
  const [companyList, setCompanyList] = useState([]);

  const searchRef = useRef(null);

  const cleanCompanyName = (name) => {
    let cleaned = name.toLowerCase();
    const patternsToRemove = [
      /\s+ltd\.?$/,
      /\s+limited$/,
      /\s+pvt\.? ltd\.?$/,
      /\s+private limited$/,
      /\s+limited liability company$/,
      /\s+llc$/,
      /\s+inc\.?$/,
      /\s+corporation$/,
      /\s+corp\.?$/,
      /\s+plc$/,
      /\s+co\.?$/,
      /\s+company$/,
    ];
    patternsToRemove.forEach((pattern) => {
      cleaned = cleaned.replace(pattern, '');
    });
    return cleaned.trim();
  };

  const getDisplayName = () => {
    if (!user) return '';
    const isSocial = user["https://your-app.com/isSocial"];
    return isSocial
      ? user.name
      : user["https://your-app.com/username"] || user.nickname || user.name;
  };

  useEffect(() => {
    const sendToBackend = async () => {
      if (isAuthenticated && user) {
        try {
          const response = await axios.post('/signin', {
            email: user.email,
            name: getDisplayName(),
          }, { withCredentials: true });
          setdisplayname(response.data.name);
          setFund(response.data.fund);
        } catch (err) {
          console.error("Signin failed", err);
        }
      }
    };
    sendToBackend();
  }, [isAuthenticated, user]);

  useEffect(() => {
    const loadCompanyList = async () => {
      try {
        const res = await fetch('/companyList.json');
        const data = await res.json();
        setCompanyList(data);
      } catch (err) {
        console.error('Failed to load company list:', err);
      }
    };
    loadCompanyList();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    try {
      const response = await axios.get('/logout', { withCredentials: true });
      if (response.status === 200) {
        logout({ logoutParams: { returnTo: window.location.origin } });
      } else {
        alert('Logout failed on server. Please try again.');
      }
    } catch (err) {
      alert('Logout failed on server. Please try again.');
      console.error('Backend logout failed:', err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setformdata(prev => ({ ...prev, [name]: value }));
    if (name === "company") {
      const input = value.toLowerCase();
      const filtered = companyList.filter(c =>
        c.name.toLowerCase().startsWith(input) ||
        c.symbol.toLowerCase().startsWith(input)
      ).slice(0, 5);
      setSuggestions(filtered);
    }
  };

  const handleSuggestionClick = (name) => {
    setformdata(prev => ({ ...prev, company: name }));
    setSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let cleanFund = parseInt(formdata.funds, 10);
    if (isNaN(cleanFund) || cleanFund < 0) {
      window.alert("Invalid amount. Please enter a non-negative number.");
      return;
    }
    try {
      const response = await axios.post('editfunds', { fund: cleanFund });
      if (response.status === 200) setFund(cleanFund);
      setformdata(prev => ({ ...prev, funds: 0 }));
    } catch (err) {
      console.log(err);
    }
  };

  const searchCompany = async (e) => {
    e.preventDefault();
    const cleanedCompany = cleanCompanyName(formdata.company);
    if (!cleanedCompany) {
      window.alert("Please enter a valid company name.");
      return;
    }
    try {
      const response = await axios.get(`https://stock.indianapi.in/stock?name=${encodeURIComponent(cleanedCompany)}`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (response.data.error) {
        window.alert(response.data.error);
      } else {
        navigate("/stock-details", { state: { stockData: response.data } });
      }
    } catch (err) {
      console.error('API error:', err);
      window.alert("Failed to fetch stock data. Please try again later.");
    }
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="navbar-container">
      <Link to="/" className="navbar-logo">STARKVEST</Link>
      <div className="nav-links">
        <Link to="/about" className={isActive('/about') ? 'active' : ''}>About</Link>
        <Link to="/contact" className={isActive('/contact') ? 'active' : ''}>Contact</Link>
        {isAuthenticated && (
          <Link to="/portfolio" className={isActive('/portfolio') ? 'active' : ''}>Portfolio</Link>
        )}
      </div>
      <div className="nav-auth">
        {isAuthenticated ? (
          <>
            <Link to="/profile" className="username"><span className="username">{displayname}</span></Link>
            <Link to='/ai' className='AI text-white'>Get Ai Suggesions</Link>
            <span className="funds">₹{Number(fund).toFixed(2)}</span>
            <form onSubmit={searchCompany} className="search-form" autoComplete="off" ref={searchRef}>
              <input
                name='company'
                value={formdata.company}
                type='text'
                onChange={handleChange}
                placeholder="Search company..."
                autoComplete="off"
              />
              <button type='submit'>Search</button>
              {suggestions.length > 0 && (
                <ul className="suggestions-dropdown">
                  {suggestions.map((item, index) => (
                    <li
                      key={index}
                      onClick={() => handleSuggestionClick(item.name)}
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          handleSuggestionClick(item.name);
                        }
                      }}
                    >
                      {item.name} ({item.symbol})
                    </li>
                  ))}
                </ul>
              )}
            </form>
            <form onSubmit={handleSubmit} className="fund-edit-form">
              <input
                name="funds"
                type="number"
                value={formdata.funds}
                onChange={handleChange}
                placeholder='Edit Funds'
              />
              <button type="submit">Edit Funds</button>
            </form>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </>
        ) : (
          <button onClick={loginWithRedirect}>Log In</button>
        )}
      </div>
    </div>
  );
};
