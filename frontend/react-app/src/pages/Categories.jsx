import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { fetchBooks } from "../services/bookService";
import BookGrid from "../components/BookGrid";
import "../styles/books.css";

const CATEGORIES = [
  { id: "business", label: "Business", icon: "fas fa-briefcase" },
  { id: "technology", label: "Technology", icon: "fas fa-code" },
  { id: "fiction", label: "Fiction", icon: "fas fa-book-open" },
  { id: "self-help", label: "Self-Help", icon: "fas fa-lightbulb" },
  { id: "science", label: "Science", icon: "fas fa-flask-vial" },
  { id: "history", label: "History", icon: "fas fa-scroll" },
  { id: "biography", label: "Biography", icon: "fas fa-user-tie" },
  { id: "mystery", label: "Mystery", icon: "fas fa-mask" }
];

export default function Categories() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("cat") || "business");

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
          
          // Filter by category (simulated)
          booksArray = booksArray.filter((_, idx) => idx % CATEGORIES.length === CATEGORIES.findIndex(c => c.id === selectedCategory));
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
  }, [selectedCategory]);

  const currentCategory = CATEGORIES.find(c => c.id === selectedCategory);
  const currentCategoryLabel = currentCategory?.label || "Books";

  const handleCategoryChange = (catId) => {
    setSelectedCategory(catId);
    setSearchParams({ cat: catId });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-inner">
          <div className="loading-orb" />
          <div className="loading-rings">
            <span /><span /><span />
          </div>
          <p className="loading-text">Loading category…</p>
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
        <h1 className="page-title">
          <i className={`${currentCategory?.icon} category-icon`}></i> {currentCategoryLabel}
        </h1>
        <p className="page-subtitle">Explore the best books in {currentCategoryLabel.toLowerCase()}</p>
      </div>

      <div className="category-filters">
        {CATEGORIES.map(cat => (
          <button
            key={cat.id}
            className={`filter-btn ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => handleCategoryChange(cat.id)}
            title={cat.label}
          >
            <i className={cat.icon}></i> {cat.label}
          </button>
        ))}
      </div>

      <div className="books-container">
        <BookGrid books={books} className="category-grid" />
      </div>
    </div>
  );
}
