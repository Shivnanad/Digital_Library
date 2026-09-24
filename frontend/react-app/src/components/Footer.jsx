import React from "react";
import "../styles/footer.css";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-col footer-brand">
          <h2 className="footer-logo">Readify</h2>
          <p className="footer-desc">Welcome to Readify, your ultimate destination for discovering and enjoying the best books.</p>
          <div className="socials" aria-hidden>
            <span className="social">◯</span>
            <span className="social">◯</span>
            <span className="social">◯</span>
            <span className="social">◯</span>
            <span className="social">◯</span>
          </div>
          <div className="lang-select">
            <button className="lang-btn">English (US)</button>
          </div>
        </div>

        <div className="footer-col">
          <h3>Explore</h3>
          <ul>
            <li>Browse Popular</li>
            <li>Browse New</li>
            <li>Release Calendar</li>
            <li>News</li>
            <li>Genres</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Resources</h3>
          <ul>
            <li>About</li>
            <li>Get the Apps</li>
            <li>Jobs</li>
            <li>Help Center</li>
            <li>Press</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3>Account</h3>
          <ul>
            <li className="accent">Start a Free Trial</li>
            <li>Switch Profile</li>
            <li>Watchlist</li>
            <li>Crunchylists</li>
            <li>History</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>© {new Date().getFullYear()} Readify</p>
        <nav className="bottom-links">
          <span>Terms of Use</span>
          <span>Privacy Policy</span>
          <span>Content Feedback</span>
        </nav>
      </div>
    </footer>
  );
}
