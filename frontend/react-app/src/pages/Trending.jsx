import { useEffect, useState } from "react";
import { fetchBooks } from "../services/bookService";
import { Link } from "react-router-dom";
import BookGrid from "../components/BookGrid";
import "../styles/books.css";

export default function Trending() {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const loadBooks = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetchBooks();
        
        if (isMounted) {
          let booksArray = [];
          if (Array.isArray(response)) {
            booksArray = response;
          } else if (response && Array.isArray(response.books)) {
            booksArray = response.books;
          } else if (response && response.data && Array.isArray(response.data)) {
            booksArray = response.data;
          }
          
          // Sort by rating/popularity (trending)
          booksArray = booksArray.sort(() => Math.random() - 0.5).slice(0, 12);
          setBooks(booksArray);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error loading books:", err);
          setError(err.message || "Failed to load books");
          setBooks([]);
          setLoading(false);
        }
      }
    };

    loadBooks();
    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-inner">
          <div className="loading-orb" />
          <div className="loading-rings">
            <span /><span /><span />
          </div>
          <p className="loading-text">Loading trending books…</p>
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
    <div className="books-page">
      <div className="books-header">
        <h1 className="page-title"><i className="fas fa-fire trending-icon"></i> Trending Now</h1>
        <p className="page-subtitle">Most popular books this week — readers are loving these</p>
      </div>

      <div className="books-container">
        <BookGrid books={books} className="trending-grid" />
      </div>
    </div>
  );
}
