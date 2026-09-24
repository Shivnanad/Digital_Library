import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/books.css";

function formatTimeAgo(ts) {
  if (!ts) return "";
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp)) return "";
  const normalizedTimestamp = timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
  const diff = Math.max(0, Date.now() - normalizedTimestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function BookCard({ book, className = "", variant = "default" }) {
  if (!book) return null;
  const isOutOfStock = book.inStock === false;

  const [nowTick, setNowTick] = useState(Date.now());
  const timeAgo = useMemo(() => {
    if (variant !== "continue") return "";
    return book.lastRead ? formatTimeAgo(book.lastRead) : "";
  }, [book.lastRead, nowTick, variant]);

  useEffect(() => {
    if (variant !== "continue") return undefined;
    const intervalId = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(intervalId);
  }, [variant]);

  /* ── Continue Reading variant (Crunchyroll-style) ── */
  if (variant === "continue") {
    const rawProgress = Number(book.progress ?? book.readProgress ?? 0);
    const hasStarted = Boolean(book.lastRead);
    const progressValue = Math.min(100, Math.max(hasStarted ? 5 : 0, Number.isFinite(rawProgress) ? rawProgress : 0));
    return (
      <div className={`cr-card ${className}`}>
        <Link to={`/read/${book._id}`} className="cr-link">
          <div className="cr-cover-wrap">
            <img
              src={book.coverUrl || "/default-cover.svg"}
              alt={book.title}
              className="cr-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-cover.svg"; }}
            />
            <div className="cr-overlay">
              <div className="cr-play-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
            <div className="cr-progress-bar">
              <div className="cr-progress-fill" style={{ width: `${progressValue}%` }} />
            </div>
          </div>
          <div className="cr-info">
            <h4 className="cr-title">{book.title}</h4>
            <p className="cr-author">{book.author}</p>
            {timeAgo && <span className="cr-time">{timeAgo}</span>}
          </div>
        </Link>
      </div>
    );
  }

  if (variant === "carousel") {
    return (
      <div className={`bcc-card ${isOutOfStock ? "bcc-card-out" : ""} ${className}`}>
        <div className="bcc-img-wrap">
          <img
            src={book.coverUrl || "/default-cover.svg"}
            alt={book.title}
            className="bcc-img"
            onError={(e) => {
              e.currentTarget.onerror = null;
              const id = book._id;
              if (id && e.currentTarget.src.includes(`/covers/${id}.jpg`)) {
                e.currentTarget.src = `/covers/${id}.png`;
                e.currentTarget.onerror = (ev) => { ev.currentTarget.onerror = null; ev.currentTarget.src = "/default-cover.svg"; };
              } else {
                e.currentTarget.src = "/default-cover.svg";
              }
            }}
          />
        </div>
        <div className="bcc-info">
          {isOutOfStock && <div className="stock-pill">Out of Stock</div>}
          <h3 className="bcc-title">{book.title}</h3>
          <p className="bcc-author">{book.author}</p>
          <p className="bcc-price">₹{book.price || 399}</p>
          {isOutOfStock ? (
            <span className="bcc-btn stock-disabled-link" aria-disabled="true">Out of Stock</span>
          ) : (
            <Link to={`/book/${book._id}`} className="bcc-btn" state={{ resumePosition: book.lastPosition }}>
              View Details
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`book-card ${isOutOfStock ? "book-card-out" : ""} ${className}`}> 
      <div className="book-image-wrapper">
        <img
          src={book.coverUrl || "/default-cover.svg"}
          alt={book.title}
          className="book-cover"
          onError={(e) => {
            e.currentTarget.onerror = null;
            const id = book._id;
            if (id && e.currentTarget.src.includes(`/covers/${id}.jpg`)) {
              e.currentTarget.src = `/covers/${id}.png`;
              e.currentTarget.onerror = (ev) => { ev.currentTarget.onerror = null; ev.currentTarget.src = "/default-cover.svg"; };
            } else {
              e.currentTarget.src = "/default-cover.svg";
            }
          }}
        />
      </div>
      <div className="book-body">
        <div className="book-meta">
          {isOutOfStock && <div className="stock-pill">Out of Stock</div>}
          <h3 className="book-title">{book.title}</h3>
          <p className="book-author">{book.author}</p>

          {/* Price / discount display */}
          <div className="book-price-row">
            <div className="book-price">₹{book.price || Math.floor(Math.random() * 400 + 150)}</div>
            {book.oldPrice && <div className="book-old-price">₹{book.oldPrice}</div>}
            {book.discount && <div className="book-discount">{book.discount}% off</div>}
          </div>
        </div>

        <div className="book-footer">
          {isOutOfStock ? (
            <span className="details-btn stock-disabled-link" aria-disabled="true">Out of Stock</span>
          ) : (
            <Link to={`/book/${book._id}`} className="details-btn" state={{ resumePosition: book.lastPosition }}>
              View Details
            </Link>
          )}
        </div>
      </div>

      {/* Persistent floating details button to ensure visibility in all layouts */}
      {isOutOfStock ? (
        <span className="details-floating stock-disabled-floating" aria-hidden="true">⌖</span>
      ) : (
        <Link
          to={`/book/${book._id}`}
          className="details-floating"
          aria-label={`View details for ${book.title}`}
          state={{ resumePosition: book.lastPosition }}
        >
          ⌖
        </Link>
      )}

      {/* Floating cover page button */}
      {isOutOfStock ? (
        <span className="cover-floating stock-disabled-floating" aria-hidden="true">Out</span>
      ) : (
        <Link
          to={`/book/${book._id}/cover`}
          className="cover-floating"
          aria-label={`Open cover for ${book.title}`}
          state={{ resumePosition: book.lastPosition }}
        >
          Cover
        </Link>
      )}
    </div>
  );
}
