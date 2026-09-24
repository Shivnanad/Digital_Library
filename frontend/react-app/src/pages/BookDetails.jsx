import { useParams, Link, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { fetchBookById, fetchBooks } from "../services/bookService";
import { addToCart } from "../services/cartService";
import { checkBookPurchased } from "../services/orderService";
import { getPlaylists, addBookToPlaylist, createPlaylist } from "../services/playlistService";
import BookCard from "../components/BookCard";
import "../styles/bookDetails.css";

const API = "http://localhost:5000/api";

// Interactive Star Picker (for the review form)
function StarPicker({ value, onChange, size = "large" }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className={`star-picker star-${size}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`star-pick-btn ${star <= (hovered || value) ? "filled" : "empty"
            }`}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          aria-label={`${star} star`}
        >
          ★
        </button>
      ))}
      {value > 0 && (
        <span className="star-label">
          {["Terrible", "Poor", "Average", "Good", "Excellent"][value - 1]}
        </span>
      )}
    </div>
  );
}

// Display-only star rating
function StarRating({ rating, size = "small" }) {
  return (
    <div className={`star-rating ${size}`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= Math.round(rating) ? "star filled" : "star empty"}>
          ★
        </span>
      ))}
    </div>
  );
}

// Sample preview component
function SamplePreview() {
  const samples = [
    { page: 1, title: "Chapter 1: The Beginning", content: "It was a crisp autumn morning when everything changed..." },
    { page: 2, title: "Chapter 1 (Continued)", content: "The story unfolds with unexpected twists and turns. Each page reveals more about the protagonist's journey..." },
    { page: 3, title: "Chapter 2: Discovery", content: "New discoveries await as the narrative deepens. The world expands with rich details and compelling narratives..." }
  ];

  return (
    <div className="sample-preview">
      <h3 className="section-title">📖 Preview (Sample Only)</h3>
      <div className="preview-warning">Sample pages shown. Purchase to read full book.</div>
      <div className="preview-pages">
        {samples.map((sample) => (
          <div key={sample.page} className="preview-page">
            <div className="page-header">
              <span className="page-number">Page {sample.page}</span>
              <span className="page-title">{sample.title}</span>
            </div>
            <p className="page-content">{sample.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Review card component
function ReviewCard({ review }) {
  return (
    <div className="review-card">
      <div className="review-header">
        <div className="reviewer-info">
          <h4 className="reviewer-name">{review.author}</h4>
          <p className="review-date">{review.date}</p>
        </div>
        <StarRating rating={review.rating} size="small" />
      </div>
      <p className="review-text">{review.text}</p>
    </div>
  );
}

export default function BookDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addToWishlist } = useWishlist();

  const [book, setBook] = useState(null);
  const [similarBooks, setSimilarBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cartMessage, setCartMessage] = useState("");

  // Purchase state
  const [isPurchased, setIsPurchased] = useState(false);

  // Playlist modal state
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [playlistMsg, setPlaylistMsg] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [avgRating, setAvgRating] = useState(0);
  const [breakdown, setBreakdown] = useState({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const [totalReviews, setTotalReviews] = useState(0);

  // Write review state
  const [newRating, setNewRating] = useState(0);
  const [newTitle, setNewTitle] = useState("");
  const [newText, setNewText] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Helpful votes — persisted per user per book in localStorage
  const voteStorageKey = `dl_votes_${user?._id || "guest"}_${id}`;
  const [votedReviews, setVotedReviews] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`dl_votes_${user?._id || "guest"}_${id}`)) || {}; }
    catch { return {}; }
  });

  // Reload votes from localStorage whenever user changes (login / logout)
  useEffect(() => {
    try {
      const key = `dl_votes_${user?._id || "guest"}_${id}`;
      setVotedReviews(JSON.parse(localStorage.getItem(key)) || {});
    } catch {
      setVotedReviews({});
    }
  }, [user?._id, id]);

  // Fetch reviews for this book
  const fetchReviews = async (bookId) => {
    try {
      setReviewsLoading(true);
      const res = await fetch(`${API}/books/${bookId}/reviews`);
      const data = await res.json();
      setReviews(data.reviews || []);
      setAvgRating(data.avgRating || 0);
      setBreakdown(data.breakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
      setTotalReviews(data.total || 0);
    } catch (e) {
      console.error("Error fetching reviews", e);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Submit a new review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmitError("");
    setSubmitSuccess("");
    if (!user) { navigate("/login"); return; }
    if (newRating === 0) { setSubmitError("Please select a star rating."); return; }
    if (!newText.trim()) { setSubmitError("Please write your review."); return; }
    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const res = await fetch(`${API}/books/${id}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating: newRating, title: newTitle, text: newText })
      });
      const data = await res.json();
      if (!res.ok) { setSubmitError(data.message || "Failed to submit."); return; }
      setSubmitSuccess("Your review was posted! Thank you.");
      setNewRating(0); setNewTitle(""); setNewText("");
      fetchReviews(id);
    } catch (e) {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Helpful vote
  const handleVote = async (reviewId, vote) => {
    const prevVote = votedReviews[reviewId] || null;
    const nextVote = prevVote === vote ? null : vote; // null = undo
    try {
      const res = await fetch(`${API}/books/reviews/${reviewId}/vote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, prevVote })
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(prev => prev.map(r =>
          r._id === reviewId ? { ...r, helpful: data.helpful, notHelpful: data.notHelpful } : r
        ));
        const key = `dl_votes_${user?._id || "guest"}_${id}`;
        const updated = { ...votedReviews };
        if (nextVote === null) delete updated[reviewId];
        else updated[reviewId] = nextVote;
        setVotedReviews(updated);
        localStorage.setItem(key, JSON.stringify(updated));
      }
    } catch (e) { console.error(e); }
  };

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    if (months >= 1) return `${months} month${months > 1 ? "s" : ""} ago`;
    if (weeks >= 1) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
    if (days >= 1) return `${days} day${days > 1 ? "s" : ""} ago`;
    if (hrs >= 1) return `${hrs} hour${hrs > 1 ? "s" : ""} ago`;
    return `${mins} minute${mins > 1 ? "s" : ""} ago`;
  }

  // Fetch book details
  useEffect(() => {
    let isMounted = true;

    const loadBook = async () => {
      try {
        setLoading(true);
        setError(null);

        const bookData = await fetchBookById(id);

        if (isMounted) {
          setBook(bookData);

          // Fetch similar books (same category, backfill from others if few)
          try {
            const allBooks = await fetchBooks();
            const booksArray = allBooks.books || allBooks.data || allBooks;
            if (Array.isArray(booksArray)) {
              const sameCategory = booksArray.filter(b => b.category?._id === bookData.category?._id && b._id !== id);
              let similar = sameCategory;
              // If same-category results are scarce, backfill with other popular books
              if (similar.length < 8) {
                const others = booksArray.filter(b => b._id !== id && !sameCategory.some(s => s._id === b._id));
                similar = [...similar, ...others.slice(0, 8 - similar.length)];
              }
              setSimilarBooks(similar);
            } else {
              setSimilarBooks([]);
            }
          } catch (err) {
            console.error("Error fetching similar books:", err);
          }

          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error loading book:", err);
          setError(err.message || "Failed to load book details");
          setLoading(false);
        }
      }
    };

    loadBook();
    fetchReviews(id);

    return () => {
      isMounted = false;
    };
  }, [id]);

  // Check if user has purchased this book
  useEffect(() => {
    if (!user || !id) return;
    checkBookPurchased(id)
      .then((purchased) => setIsPurchased(purchased))
      .catch(() => setIsPurchased(false));
  }, [user, id]);

  // Fetch user playlists (when modal opens)
  const handleOpenPlaylistModal = async () => {
    setShowPlaylistModal(true);
    setPlaylistMsg("");
    setPlaylistsLoading(true);
    try {
      const data = await getPlaylists();
      setPlaylists(data.playlists || []);
    } catch {
      setPlaylists([]);
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const handleAddBookToPlaylist = async (playlistId) => {
    setPlaylistMsg("");
    try {
      await addBookToPlaylist(playlistId, id);
      setPlaylistMsg("✓ Added to playlist!");
      setTimeout(() => { setPlaylistMsg(""); setShowPlaylistModal(false); }, 1500);
    } catch (e) {
      setPlaylistMsg(e.message || "Already in playlist or failed.");
    }
  };

  const handleCreateAndAdd = async (e) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    setCreatingPlaylist(true);
    setPlaylistMsg("");
    try {
      const data = await createPlaylist(newPlaylistName.trim());
      const pid = data.playlist._id;
      await addBookToPlaylist(pid, id);
      setPlaylistMsg(`✓ Created "${newPlaylistName.trim()}" and added book!`);
      setNewPlaylistName("");
      setTimeout(() => { setPlaylistMsg(""); setShowPlaylistModal(false); }, 1800);
    } catch (e) {
      setPlaylistMsg(e.message || "Failed to create playlist.");
    } finally {
      setCreatingPlaylist(false);
    }
  };

  // Setup carousel scroll buttons
  useEffect(() => {
    const container = document.getElementById('similarBooksContainer');
    const scrollLeftBtn = document.getElementById('scrollLeft');
    const scrollRightBtn = document.getElementById('scrollRight');

    if (!container || !scrollLeftBtn || !scrollRightBtn) return;

    const handleScroll = (direction) => {
      const scrollAmount = 300; // Pixels to scroll
      if (direction === 'left') {
        container.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
      } else {
        container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      }
    };

    const handleScrollLeft = () => handleScroll('left');
    const handleScrollRight = () => handleScroll('right');
    scrollLeftBtn.addEventListener('click', handleScrollLeft);
    scrollRightBtn.addEventListener('click', handleScrollRight);

    // Pass vertical wheel events through to the page
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        window.scrollBy({ top: e.deltaY, behavior: 'auto' });
      }
    };
    container.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      scrollLeftBtn.removeEventListener('click', handleScrollLeft);
      scrollRightBtn.removeEventListener('click', handleScrollRight);
      container.removeEventListener('wheel', onWheel);
    };
  }, [similarBooks]);

  // Handle Add to Cart
  const handleAddToCart = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    // Add minimal book info to cart
    addToCart({
      _id: book._id,
      title: book.title,
      author: book.author,
      price: book.price || 0,
      coverUrl: book.coverUrl || "/placeholder-book.png",
    });
    setCartMessage("Added to cart! ✓");
    setTimeout(() => setCartMessage(""), 3000);
  };

  // Handle Buy Now
  const handleBuyNow = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    navigate("/checkout", { state: { book } });
  };

  // Handle Wishlist
  const handleAddToWishlist = () => {
    if (!user) {
      navigate("/login");
      return;
    }
    try {
      addToWishlist(book);
      setCartMessage("Added to wishlist! ❤️");
      setTimeout(() => setCartMessage(""), 3000);
    } catch (err) {
      console.error("Wishlist error:", err);
    }
  };

  if (loading) {
    return (
      <div className="details-page">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading book details...</p>
        </div>
      </div>
    );
  }

  if (error || !book) {
    return (
      <div className="details-page">
        <div className="error-container">
          <p className="error-message">❌ {error || "Book not found"}</p>
          <Link to="/app" className="error-back-link">
            <span>↖</span>
            <span>Back to Home</span>
          </Link>
        </div>
      </div>
    );
  }

  const averageRating = avgRating || 0;
  const reviewCount = totalReviews;

  return (
    <div className="details-page">
      {/* Main Details Card (3-column layout) */}
      <div className="details-card">
        <Link to="/app" className="back-to-home-btn back-to-home-top-left">
          <span>←</span>
          <span>Back to Home</span>
        </Link>

        {/* Left: Book Cover */}
        <div className="details-left">
          <div className="cover-container">
            <div className="cover-smoke" aria-hidden="true"></div>
            <img
              src={book.coverUrl || "/placeholder-book.svg"}
              alt={book.title}
              className="details-cover"
            />
          </div>
        </div>

        {/* Center: Book Info + Preview */}
        <div className="details-center">
          <div className="book-header">
            <h1 className="book-title">{book.title}</h1>
            <p className="book-author">by {book.author}</p>
          </div>

          <div className="book-meta">
            <div className="rating-section">
              <StarRating rating={averageRating} size="medium" />
              <span className="rating-text">{averageRating}/5 ({reviewCount} reviews)</span>
            </div>
          </div>

          <p className="book-description">{book.description || "No description available."}</p>

          <div className="book-info-grid">
            <div className="info-item"><span className="info-label">Language</span><span className="info-value">English</span></div>
            <div className="info-item"><span className="info-label">Pages</span><span className="info-value">352</span></div>
            <div className="info-item"><span className="info-label">Published</span><span className="info-value">2024</span></div>
            <div className="info-item"><span className="info-label">Format</span><span className="info-value">Digital</span></div>
          </div>

          <div className="pricing-section stacked">
            <div className="price-options">
              <div className="price-option buy"><span className="price-label">Buy</span><span className="price-amount">₹{book.price || Math.floor(Math.random() * 400 + 150)}</span><span className="price-period">one-time</span></div>
            </div>

            {cartMessage && <div className="success-message">{cartMessage}</div>}

            {isPurchased ? (
              /* ── PURCHASED: show Read + Playlist ── */
              <div className="action-buttons">
                <a
                  className="btn btn-primary"
                  onClick={() => navigate(`/read/${id}`)}
                  style={{ cursor: "pointer" }}
                >
                  📖 Read Book
                </a>
                <button className="btn btn-secondary" onClick={handleOpenPlaylistModal}>
                  🎵 Add to Playlist
                </button>
              </div>
            ) : (
              /* ── NOT PURCHASED: show buy/cart ── */
              <div className="action-buttons">
                <button className="btn btn-primary" onClick={handleAddToCart}>🛒 Add to Cart</button>
                <button className="btn btn-secondary" onClick={handleBuyNow}>💳 Buy Now</button>
                <button className="btn btn-outline" onClick={handleAddToWishlist}>❤️ Wishlist</button>
              </div>
            )}

            {/* ── Playlist modal ── */}
            {showPlaylistModal && (
              <div className="playlist-modal-overlay" onClick={() => setShowPlaylistModal(false)}>
                <div className="playlist-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="playlist-modal-header">
                    <h3>Add to Playlist</h3>
                    <button className="playlist-modal-close" onClick={() => setShowPlaylistModal(false)}>✕</button>
                  </div>

                  {playlistMsg && (
                    <p className={`playlist-msg ${playlistMsg.startsWith("✓") ? "success" : "error"}`}>
                      {playlistMsg}
                    </p>
                  )}

                  {playlistsLoading ? (
                    <p className="playlist-loading">Loading playlists…</p>
                  ) : playlists.length === 0 ? (
                    <p className="playlist-empty">No playlists yet. Create one below!</p>
                  ) : (
                    <ul className="playlist-list">
                      {playlists.map((pl) => (
                        <li key={pl._id} className="playlist-item">
                          <span
                            className="playlist-color-dot"
                            style={{ background: pl.coverColor || "#8b5cf6" }}
                          />
                          <span className="playlist-name">{pl.name}</span>
                          <span className="playlist-count">{pl.books?.length || 0} books</span>
                          <button
                            className="playlist-add-btn"
                            onClick={() => handleAddBookToPlaylist(pl._id)}
                          >
                            + Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <form className="playlist-create-form" onSubmit={handleCreateAndAdd}>
                    <input
                      className="playlist-create-input"
                      type="text"
                      placeholder="New playlist name…"
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      maxLength={60}
                    />
                    <button className="playlist-create-btn" type="submit" disabled={creatingPlaylist || !newPlaylistName.trim()}>
                      {creatingPlaylist ? "Creating…" : "Create & Add"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <SamplePreview />
        </div>

        {/* Right: Empty (removed reviews from here) */}
        <aside className="details-right">
        </aside>
      </div>

      {/* Wave → Similar Books */}
      {similarBooks.length > 0 && <div className="details-wave wave-similar" aria-hidden="true" />}

      {/* Full-Width Similar Books Carousel */}
      {similarBooks.length > 0 && (
        <div className="similar-books-carousel full-bleed">
          <div className="carousel-header">
            <h2 className="carousel-title">📚 Similar Books</h2>
            <div className="carousel-controls">
              <button className="carousel-btn carousel-btn-left" id="scrollLeft">←</button>
              <button className="carousel-btn carousel-btn-right" id="scrollRight">→</button>
            </div>
          </div>

          <div className="similar-grid-horizontal" id="similarBooksContainer">
            {similarBooks.map((similarBook) => (
              <BookCard key={similarBook._id} className="similar-book-card" variant="carousel" book={similarBook} />
            ))}
          </div>
        </div>
      )}

      {/* Wave → Reviews */}
      <div className="details-wave wave-reviews" aria-hidden="true" />

      {/* Full-Width Customer Reviews Section */}
      <div className="reviews-section-full">
        <div className="reviews-container">

          {/* ── Header + Breakdown ── */}
          <div className="reviews-top">
            <div className="reviews-summary">
              <h2 className="reviews-section-title">⭐ Customer Reviews</h2>
              {totalReviews > 0 ? (
                <>
                  <div className="avg-rating-big">
                    <span className="avg-number">{avgRating.toFixed(1)}</span>
                    <div className="avg-right">
                      <StarRating rating={avgRating} size="medium" />
                      <span className="reviews-subtitle">{totalReviews} verified review{totalReviews !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="rating-breakdown">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = breakdown[star] || 0;
                      const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                      return (
                        <div key={star} className="breakdown-row">
                          <span className="breakdown-label">{star} ★</span>
                          <div className="breakdown-bar-track">
                            <div className="breakdown-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="breakdown-count">{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="reviews-subtitle">No reviews yet. Be the first!</p>
              )}
            </div>

            {/* ── Write a Review Form ── */}
            <div className="write-review-box">
              <h3 className="write-review-title">Write a Review</h3>
              {!user ? (
                <p className="review-login-prompt">
                  <button className="review-login-btn" onClick={() => navigate("/login")}>Sign in</button> to post your review
                </p>
              ) : (
                <form className="review-form" onSubmit={handleSubmitReview}>
                  <div className="form-group">
                    <label className="form-label">Your Rating *</label>
                    <StarPicker value={newRating} onChange={setNewRating} size="large" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Review Title</label>
                    <input
                      className="review-input"
                      type="text"
                      placeholder="Summarise your experience..."
                      value={newTitle}
                      onChange={e => setNewTitle(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Your Review *</label>
                    <textarea
                      className="review-textarea"
                      placeholder="What did you like or dislike? How was the content quality?"
                      value={newText}
                      onChange={e => setNewText(e.target.value)}
                      rows={4}
                      maxLength={1000}
                    />
                    <span className="char-count">{newText.length}/1000</span>
                  </div>
                  {submitError && <p className="review-error">{submitError}</p>}
                  {submitSuccess && <p className="review-success">{submitSuccess}</p>}
                  <button className="review-submit-btn" type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Review"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ── Reviews List ── */}
          {reviewsLoading ? (
            <div className="reviews-loading">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="reviews-empty">No reviews yet for this book.</div>
          ) : (
            <div className="reviews-list">
              {reviews.map((review) => (
                <div key={review._id} className="review-card-full">
                  <div className="review-header-full">
                    <div className="reviewer-info-full">
                      <div className="reviewer-avatar">{review.userName?.charAt(0).toUpperCase()}</div>
                      <div>
                        <h3 className="reviewer-name-full">{review.userName}</h3>
                        <div className="review-meta">
                          <span className="verified-tag">✓ Verified Reader</span>
                          <span className="review-date-full">{timeAgo(review.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rating-stars-full">
                      <StarRating rating={review.rating} size="small" />
                      <span className="rating-number">{review.rating}/5</span>
                    </div>
                  </div>
                  {review.title && <p className="review-title-text">{review.title}</p>}
                  <p className="review-text-full">{review.text}</p>
                  <div className="review-footer">
                    <span className="helpful-label">Helpful?</span>
                    <button
                      className={`review-btn ${votedReviews[review._id] === "helpful" ? "voted" : ""}`}
                      onClick={() => handleVote(review._id, "helpful")}
                    >
                      👍 {review.helpful || 0}
                    </button>
                    <button
                      className={`review-btn ${votedReviews[review._id] === "notHelpful" ? "voted" : ""}`}
                      onClick={() => handleVote(review._id, "notHelpful")}
                    >
                      👎 {review.notHelpful || 0}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

