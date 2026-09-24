import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { fetchBookById } from "../services/bookService";
import BookGrid from "../components/BookGrid";
import "../styles/books.css";

export default function ReadingHistory() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  const loadReadingHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get user info to make it user-specific
      const userEmail = localStorage.getItem("email");
      const key = userEmail ? `readBooks_${userEmail}` : "readBooks";
      const raw = JSON.parse(localStorage.getItem(key) || "[]");

      // Normalize: entries can be plain IDs (string) or objects { bookId, lastRead, progress }
      const readBookIds = raw.map(entry =>
        typeof entry === "object" && entry !== null ? entry.bookId : entry
      ).filter(Boolean);

      if (readBookIds.length === 0) {
        setBooks([]);
        setLoading(false);
        return;
      }

      // De-duplicate while preserving order (most recent last → reverse for most recent first)
      const unique = [...new Set(readBookIds)].reverse();

      // Fetch full book details for each read book ID
      const bookPromises = unique.map(id =>
        fetchBookById(id).catch(() => null)
      );

      const fetchedBooks = await Promise.all(bookPromises);

      // Attach reading metadata (lastRead, progress) from stored entries
      const validBooks = fetchedBooks
        .filter(book => book !== null)
        .map(book => {
          const entry = raw.find(e =>
            (typeof e === "object" ? e.bookId : e) === book._id
          );
          if (entry && typeof entry === "object") {
            return { ...book, lastRead: entry.lastRead, readProgress: entry.progress };
          }
          return book;
        });

      setBooks(validBooks);
    } catch (err) {
      console.error("Error loading reading history:", err);
      setError(err.message || "Failed to load reading history");
      setBooks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload history whenever the page is navigated to (e.g. back from reading a book)
  useEffect(() => {
    loadReadingHistory();
  }, [loadReadingHistory, location.key]);

  // Also listen for storage changes (in case another tab updates history)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key && e.key.startsWith("readBooks")) {
        loadReadingHistory();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [loadReadingHistory]);

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear your reading history? This action cannot be undone.")) {
      const userEmail = localStorage.getItem("email");
      const key = userEmail ? `readBooks_${userEmail}` : "readBooks";
      localStorage.removeItem(key);
      setBooks([]);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-inner">
          <div className="loading-orb" />
          <div className="loading-rings">
            <span /><span /><span />
          </div>
          <p className="loading-text">Loading your reading history…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <span className="error-icon">⚠️</span>
          <p>Error: {error}</p>
          <Link to="/app" className="error-back-link"><i className="fas fa-arrow-left"></i> Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="books-page reading-history-page">
      <div className="books-header">
        <div className="header-top-section">
          <div>
            <h1 className="page-title"><i className="fas fa-history"></i> Reading History</h1>
            <p className="page-subtitle">
              {books.length} book{books.length !== 1 ? 's' : ''} you've explored
            </p>
          </div>
          {books.length > 0 && (
            <button 
              className="btn-danger"
              onClick={handleClearHistory}
              title="Clear all reading history"
            >
              <i className="fas fa-trash-alt"></i> Clear History
            </button>
          )}
        </div>
      </div>

      {books.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📖</div>
          <h2>No Reading History Yet</h2>
          <p>Start reading books to build your personal library. Each book you open will be added to your reading history.</p>
          <Link to="/app" className="btn btn-primary">
            <i className="fas fa-book"></i> Discover Books
          </Link>
        </div>
      ) : (
        <div className="books-container">
          <BookGrid books={books} className="reading-history-grid" />
        </div>
      )}
    </div>
  );
}
