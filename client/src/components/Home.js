import React, { useEffect, useState } from 'react';
import { useAuth0 } from "@auth0/auth0-react";
import { jwtDecode } from "jwt-decode";
import { Link } from 'react-router-dom';
import './Home.css';

export const Home = () => {
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    const loadNameFromToken = () => {
      try {
        const match = document.cookie.match(/(?:^|;\s*)token=([^;]+)/);
        if (!match) return;

        const token = decodeURIComponent(match[1]);
        const decoded = jwtDecode(token);
        if (decoded.name) {
          setDisplayName(decoded.name);
        } else {
          console.warn("Token decoded but name not found");
        }
      } catch (err) {
        console.error("Error decoding token:", err);
      }
    };

    if (isAuthenticated) {
      const timeout = setTimeout(() => {
        loadNameFromToken();
      }, 500);

      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated]);

  return (
    <main className="Home">
      <div className="Logo">StarkVest</div>

      <section className="hero">
        {isAuthenticated ? (
          <>
            <p className="hero-welcome">Welcome back, {displayName}!</p>
            <h1>Ready to trade again?</h1>
            <Link to="/portfolio" className="btn">Go to Dashboard</Link>
          </>
        ) : (
          <>
            <p className="hero-welcome">Welcome to StarkVest!</p>
            <h1>Play the game, Learn the market.</h1>
            <p>
              Trade faster and smarter with real-time insights and automation.
              Start simulating trades like a pro.
            </p>
            <button onClick={loginWithRedirect} className="btn">
              Signup now and Start Trading – Get ₹1,00,000 Virtual Funds
            </button>
          </>
        )}
      </section>

      {!isAuthenticated && (
        <section className="marketing-sections">
          <div className="marketing-content">
            <h2>Unlock Your Trading Potential</h2>
            <p>
              StarkVest offers a comprehensive platform for both aspiring and
              experienced traders. Dive into real-time market simulations, learn
              from expert resources, and refine your strategies with zero risk.
              Our cutting-edge AI insights help you make informed decisions,
              while our vibrant community supports your growth every step of the
              way.
            </p>
            <p>
              Join us today and transform the way you interact with the stock market.
            </p>
          </div>
        </section>
      )}
    </main>
  );
};
