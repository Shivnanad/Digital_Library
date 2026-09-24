import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useEffect, useState, useRef } from "react";
import { getCart, onCartUpdate } from "../services/cartService";
import { searchBooks } from "../services/bookService";
import { useVoice } from "../context/VoiceContext";
import "../styles/navbar.css";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const voice = useVoice();
  const location = useLocation();
  const isSearchPage = location.pathname === "/search";
  const isHomePage = location.pathname === "/";

  const [search, setSearch] = useState("");
  const [cartCount, setCartCount] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const searchFormRef = useRef(null);

  // Netflix-style: transparent at top, dark when scrolled
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close dropdown when clicking outside search form
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchFormRef.current && !searchFormRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onend = () => {
        setIsListening(false);
        // Resume background voice assistant
        if (voice && voice.resumeRecognition) {
          setTimeout(() => voice.resumeRecognition(), 300);
        }
      };

      recognition.onresult = (event) => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final_transcript += transcript + ' ';
          }
        }
        if (final_transcript.trim()) {
          const searchTerm = final_transcript.trim();
          setSearch(searchTerm);
          // Auto-search after voice recognition
          setTimeout(() => {
            navigate("/search?q=" + encodeURIComponent(searchTerm));
            setSearch("");
            setShowDropdown(false);
          }, 300);
        }
      };

      recognition.onerror = (event) => {
        // Silently handle errors — 'aborted' is normal when two recognitions overlap
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          console.warn('Voice search error:', event.error);
        }
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, [navigate]);

  useEffect(() => {
    setCartCount(getCart().reduce((s, i) => s + (i.quantity || 0), 0));
    const off = onCartUpdate((items) => setCartCount((items || []).reduce((s, i) => s + (i.quantity || 0), 0)));
    return off;
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!search.trim()) return;
    navigate("/search?q=" + encodeURIComponent(search.trim()));
    setSearch("");
    setShowDropdown(false);
  };

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) return;
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      // Resume background voice assistant
      voice.resumeRecognition();
    } else {
      setSearch('');
      // Pause background voice assistant first to avoid conflict
      voice.pauseRecognition();
      setTimeout(() => {
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already running or other issue — ignore
          voice.resumeRecognition();
        }
      }, 200);
    }
  };

  // debounce search suggestions
  useEffect(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    if (!search || !search.trim()) { setSuggestions([]); setShowDropdown(false); return; }
    const t = setTimeout(async () => {
      try {
        const results = await searchBooks(search.trim(), 6);
        setSuggestions(results || []);
        setShowDropdown((results || []).length > 0);
      } catch (err) {
        setSuggestions([]);
        setShowDropdown(false);
      }
    }, 250);
    setDebounceTimer(t);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <nav className={`navbar${(isScrolled || !isHomePage) ? " scrolled" : ""}`}>
      <div className="nav-left">
        <Link to="/app" className="logo">
          <svg className="logo-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="8" y1="7" x2="16" y2="7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            <line x1="8" y1="11" x2="13" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <div className="logo-wordmark">
            <span className="logo-title">Readify</span>
          </div>
        </Link>

        <ul className="nav-menu" role="menubar">
          <li className="nav-item"><Link to="/app" className="nav-link simple" role="menuitem">Browse</Link></li>

          <li className="nav-item dropdown" role="menuitem" aria-haspopup="true">
            <Link to="/categories" className="nav-link simple">Categories ▾</Link>
            <ul className="dropdown-menu" role="menu">
              <li><Link to="/categories?cat=business" className="dropdown-link" role="menuitem">Business</Link></li>
              <li><Link to="/categories?cat=technology" className="dropdown-link" role="menuitem">Technology</Link></li>
              <li><Link to="/categories?cat=fiction" className="dropdown-link" role="menuitem">Fiction</Link></li>
              <li><Link to="/categories?cat=self-help" className="dropdown-link" role="menuitem">Self-Help</Link></li>
              <li><Link to="/categories?cat=science" className="dropdown-link" role="menuitem">Science</Link></li>
              <li><Link to="/categories?cat=history" className="dropdown-link" role="menuitem">History</Link></li>
            </ul>
          </li>

          <li className="nav-item"><Link to="/trending" className="nav-link simple" role="menuitem">Trending</Link></li>
          <li className="nav-item"><Link to="/new-releases" className="nav-link simple" role="menuitem">New Releases</Link></li>
          <li className="nav-item"><Link to="/my-library" className="nav-link simple" role="menuitem">My Library</Link></li>
          <li className="nav-item"><Link to="/wishlist" className="nav-link simple" role="menuitem">My List</Link></li>
        </ul>
      </div>
      <div className="nav-right">
        {!isSearchPage && <form className="nav-search" ref={searchFormRef} onSubmit={handleSearchSubmit} role="search">
          <input
            className="search-input"
            type="search"
            placeholder={isListening ? "🎤 Listening..." : "Search books..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => { if (suggestions.length) setShowDropdown(true); }}
            onBlur={() => { setTimeout(()=>setShowDropdown(false), 150); }}
            aria-label="Search books"
          />
          <button
            type="button"
            className={`voice-btn ${isListening ? 'listening' : ''}`}
            onClick={handleVoiceSearch}
            title={isListening ? 'Stop listening' : 'Search by voice'}
            aria-label="Voice search"
          >
            <i className="fas fa-microphone"></i>
          </button>
          <button
            className="search-btn"
            type="submit"
            aria-label="Search"
          >
            <i className="fas fa-search"></i>
          </button>

          {showDropdown && suggestions && suggestions.length > 0 && (
            <div className="search-dropdown" role="listbox" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1200 }}>
              {suggestions.map((s) => (
                <div key={s._id} className="suggestion-item" role="option" onMouseDown={() => { setSearch(''); setShowDropdown(false); navigate(`/book/${s._id}`); }}>
                  <img src={s.coverUrl || '/placeholder-book.png'} alt="cover" className="suggestion-cover" />
                  <div className="suggestion-meta">
                    <div className="suggestion-title">{s.title}</div>
                    <div className="suggestion-author">{s.author}</div>
                  </div>
                </div>
              ))}
              <div
                className="suggestion-see-all"
                onMouseDown={() => { setShowDropdown(false); navigate(`/search?q=${encodeURIComponent(search.trim())}`); setSearch(''); }}
              >
                <i className="fas fa-search"></i> See all results for &nbsp;<strong>"{search}"</strong>
              </div>
            </div>
          )}
        </form>}

        <button className="theme-toggle" onClick={toggleTheme} aria-label="Toggle theme" title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          {theme === "dark" ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"></circle>
              <path d="M12 2v2"></path>
              <path d="M12 20v2"></path>
              <path d="m4.93 4.93 1.41 1.41"></path>
              <path d="m17.66 17.66 1.41 1.41"></path>
              <path d="M2 12h2"></path>
              <path d="M20 12h2"></path>
              <path d="m6.34 17.66-1.41 1.41"></path>
              <path d="m19.07 4.93-1.41 1.41"></path>
            </svg>
          )}
        </button>

        <Link to="/cart" className="nav-link cart-link" aria-label="Cart">
          <i className="fas fa-shopping-cart"></i>
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </Link>

        {/* Profile link — shows pic or generic icon */}
        <Link to="/account" className="nav-link profile-link" aria-label="Account">
          {user?.profilePic ? (
            <img src={`http://localhost:5000${user.profilePic}`} alt="" className="nav-avatar-img" />
          ) : (
            <i className="fas fa-user"></i>
          )}
        </Link>

        {/* right-side logo removed; only left logo is used */}
      </div>
    </nav>
  );
}
