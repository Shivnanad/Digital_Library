import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "../styles/heroBanner.css";

// One video file per banner slide (place MP4s in /videos/banner/)
const SLIDE_VIDEOS = [
  "/videos/banner/v1.mp4",
  "/videos/banner/v2.mp4",
  "/videos/banner/v3.mp4",
  "/videos/banner/v4.mp4",
  "/videos/banner/v5.mp4",
];

export default function HeroBanner({ books }) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);
  const navigate = useNavigate();
  const intervalRef = useRef(null);
  const resumeTimeoutRef = useRef(null);
  const videoRefs = useRef([]);

  if (!books || books.length === 0) return null;

  // Limit banner animation to the first 5 books for a compact, smooth carousel
  const visibleBooks = Array.isArray(books) ? books.slice(0, 5) : [];
  const currentBook = visibleBooks[currentIndex % visibleBooks.length];
  const bannerImage = currentBook.coverUrl || "/placeholder-book.png";

  // Auto-slide every 5 seconds using refs to avoid duplicate intervals
  useEffect(() => {
    // clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isAutoPlay || visibleBooks.length <= 1) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleBooks.length);
    }, 4000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAutoPlay, books.length]);

  // Reset index if books list changes and currentIndex out of range
  useEffect(() => {
    if (!visibleBooks || visibleBooks.length === 0) return;
    if (currentIndex >= visibleBooks.length) setCurrentIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length]);

  // Play the video for the active slide; pause others
  useEffect(() => {
    videoRefs.current.forEach((vid, idx) => {
      if (!vid) return;
      if (idx === currentIndex % SLIDE_VIDEOS.length) {
        vid.currentTime = 0;
        vid.play().catch(() => {});
      } else {
        vid.pause();
      }
    });
  }, [currentIndex]);

  const handlePrev = () => {
    // pause autoplay when user navigates manually, then resume after delay
    setIsAutoPlay(false);
    setCurrentIndex((prev) => (prev - 1 + visibleBooks.length) % visibleBooks.length);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => setIsAutoPlay(true), 8000);
  };

  const handleNext = () => {
    setIsAutoPlay(false);
    setCurrentIndex((prev) => (prev + 1) % visibleBooks.length);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => setIsAutoPlay(true), 8000);
  };

  const handleReadNow = () => {
    navigate(`/book/${currentBook._id}`);
  };

  const handleMouseEnter = () => {
    setIsAutoPlay(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleMouseLeave = () => {
    // resume autoplay after short delay to avoid accidental restarts
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => setIsAutoPlay(true), 1200);
  };

  return (
    <div className={`hero-banner${theme === "light" ? " light-mode" : ""}`} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>

      {/* ── Video backgrounds ── */}
      {SLIDE_VIDEOS.map((src, idx) => (
        <video
          key={idx}
          ref={(el) => (videoRefs.current[idx] = el)}
          className={`hero-bg-video ${idx === currentIndex % SLIDE_VIDEOS.length ? "active" : ""}`}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      ))}

      {/* ── Netflix-style gradient overlays ── */}
      <div className="hero-grad-left" aria-hidden="true" />
      <div className="hero-grad-bottom" aria-hidden="true" />
      <div className="hero-grad-top" aria-hidden="true" />

      {/* ── Content — bottom-left ── */}
      <div className="hero-content">
        <div className="hero-meta-badge">#{currentIndex + 1} in Books Today</div>
        <h1 className="hero-title">{currentBook.title}</h1>
        <p className="hero-description">{currentBook.description?.substring(0, 180)}...</p>

        <div className="hero-buttons">
          <button className="btn-play" onClick={handleReadNow}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M8 5v14l11-7z"/></svg>
            Read Now
          </button>
          <button className="btn-more-info" onClick={handleReadNow}>
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            More Info
          </button>
        </div>
      </div>

      {/* ── Slide progress bars (bottom-right) ── */}
      <div className="hero-progress-bars">
        {visibleBooks.map((_, idx) => (
          <button
            key={idx}
            className={`hero-progress-bar ${idx === currentIndex ? "active" : ""}`}
            onClick={() => { setCurrentIndex(idx); setIsAutoPlay(false); }}
            aria-label={`Go to slide ${idx + 1}`}
          />
        ))}
      </div>

      {/* ── Arrow navigation ── */}
      <button className="hero-arrow hero-arrow-left" onClick={handlePrev} aria-label="Previous">&#8249;</button>
      <button className="hero-arrow hero-arrow-right" onClick={handleNext} aria-label="Next">&#8250;</button>
    </div>
  );
}