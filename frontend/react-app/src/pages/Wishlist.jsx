import React from "react";
import { Link } from "react-router-dom";
import { useWishlist } from "../context/WishlistContext";
import "../styles/books.css";

export default function Wishlist() {
  const { wishlist, removeFromWishlist, clearWishlist } = useWishlist();

  const handleClearList = () => {
    if (window.confirm("Are you sure you want to remove all books from your list?")) {
      clearWishlist();
    }
  };

  return (
    <div className="books-page wishlist-page">
      <div className="books-header">
        <div className="header-top-section">
          <div>
            <h1 className="page-title"><i className="fas fa-heart"></i> My List</h1>
            <p className="page-subtitle">
              {wishlist.length} book{wishlist.length !== 1 ? 's' : ''} saved
            </p>
          </div>
          {wishlist.length > 0 && (
            <button
              className="btn-danger"
              onClick={handleClearList}
              title="Clear all saved books"
            >
              <i className="fas fa-trash-alt"></i> Clear List
            </button>
          )}
        </div>
      </div>

      {wishlist.length === 0 ? (
        <div className="empty-wishlist">
          <div className="empty-icon">📚</div>
          <h2>Your List is Empty</h2>
          <p>Start adding books to your list to keep track of what you want to read</p>
          <Link to="/app" className="btn btn-primary">Browse Books</Link>
        </div>
      ) : (
        <div className="wishlist-container">
          <div className="wishlist-grid">
            {wishlist.map((book) => (
              <div key={book._id} className="wishlist-item">
                <div className="bcc-card">
                  <div className="bcc-img-wrap">
                    <img
                      src={book.coverUrl || "/images/placeholder.png"}
                      alt={book.title}
                      className="bcc-img"
                    />
                  </div>
                  <div className="bcc-info">
                    <h3 className="bcc-title">{book.title}</h3>
                    <p className="bcc-author">{book.author}</p>
                    <p className="bcc-price">₹{book.price}</p>
                  </div>
                </div>
                <div className="wishlist-actions">
                  <button
                    className="btn btn-outline"
                    onClick={() => removeFromWishlist(book._id)}
                  >
                    <i className="fas fa-trash"></i> Remove
                  </button>
                  <Link to={`/book/${book._id}`} className="btn btn-primary">
                    <i className="fas fa-arrow-right"></i> View
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
