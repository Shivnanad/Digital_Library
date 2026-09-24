import { useRef, useState, useEffect } from "react";
import BookCard from "./BookCard";
import "../styles/horizontalScroll.css";

function getSectionMeta(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('continue') && t.includes('reading')) return { key: 'continue-reading', badge: 'Resume', subtitle: 'Pick up right where you left off' };
  if (t.includes('trending')) return { key: 'trending', badge: 'Special', subtitle: 'Popular this week — readers are loving these' };
  if (t.includes('motivation') || t.includes('self-help')) return { key: 'motivation', badge: 'Boost', subtitle: 'Inspiring reads to grow your mindset' };
  if (t.includes('recommended')) return { key: 'recommended', badge: 'For You', subtitle: 'Hand-picked suggestions based on interests' };
  if (t.includes('all books') || t.includes('all')) return { key: 'all', badge: 'Library', subtitle: 'Explore the entire collection' };
  return { key: '', badge: '', subtitle: '' };
}

export default function HorizontalScrollRow({ title, books, showProgress = false, compact = false, variant = "default", alignLeft = false }) {
  const scrollContainerRef = useRef(null);
  const [layout, setLayout] = useState("horizontal"); // 'horizontal' or 'vertical'
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  if (!books || books.length === 0) return null;

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      // Scroll by one card width (+ gap) for card-by-card scrolling
      const container = scrollContainerRef.current;
      const firstItem = container.querySelector('.scroll-item');
      const style = window.getComputedStyle(container);
      const gap = parseInt(style.gap || style.columnGap || 12, 10) || 12;
      const itemWidth = firstItem ? firstItem.offsetWidth : 220;
      const scrollAmount = itemWidth + gap;
      container.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: 'smooth' });

      // Check scroll state after animation
      setTimeout(handleScroll, 300);
    }
  };

  // Redirect vertical wheel events to the page — browsers claim wheel events
  // for overflow-x:auto containers even when scrolling vertically.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        window.scrollBy(0, e.deltaY); // instant, no smooth conflict
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [layout]);

  // Ensure initial scroll state is correct and respond to resize
  useEffect(() => {
    handleScroll();
    window.addEventListener("resize", handleScroll);
    return () => window.removeEventListener("resize", handleScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recalculate when books change (ensure arrows state correct)
  useEffect(() => {
    // small timeout to allow layout to stabilize
    const t = setTimeout(handleScroll, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books]);

  // If variant is 'details' render markup/classes matching details page carousel
  if (variant === "details") {
    const wrapperStyle = alignLeft ? { width: '100vw', marginLeft: 'calc(50% - 50vw)', paddingLeft: 0, paddingRight: 0 } : {};
    const headerStyle = alignLeft ? { paddingLeft: 0, paddingRight: 'var(--container-padding)', width: '100%' } : {};
    const gridStyle = alignLeft ? { paddingLeft: 0, paddingRight: 0, width: '100%' } : {};
    const meta = getSectionMeta(title);
    const cardVariant = showProgress ? "continue" : "carousel";
    return (
      <div className={`similar-books-carousel ${alignLeft ? 'align-left' : ''}`} style={wrapperStyle}>
        <div className="carousel-header" style={headerStyle}>
          <div className={`section-title-wrap ${meta.key || ''}`}>
            <h2 className="carousel-title">{title}
              {meta.badge && <span className="title-badge">{meta.badge}</span>}
            </h2>
            {meta.subtitle && <p className="section-subtitle">{meta.subtitle}</p>}
          </div>
          <div className="carousel-controls">
            <button
              className={`carousel-btn carousel-btn-left ${canScrollLeft ? "" : "disabled"}`}
              onClick={() => scroll("left")}
              aria-label="Scroll left"
              disabled={!canScrollLeft}
            >
              ←
            </button>
            <button
              className={`carousel-btn carousel-btn-right ${canScrollRight ? "" : "disabled"}`}
              onClick={() => scroll("right")}
              aria-label="Scroll right"
              disabled={!canScrollRight}
            >
              →
            </button>
          </div>
        </div>

        {layout === "horizontal" ? (
          <div className="similar-grid-horizontal" ref={scrollContainerRef} onScroll={handleScroll} style={gridStyle}>
            {books.map((book) => (
              <BookCard key={book._id} className="similar-book-card scroll-item" variant={cardVariant} book={book} />
            ))}
          </div>
        ) : (
          <div className="vertical-list" ref={scrollContainerRef} onScroll={handleScroll}>
            {books.map((book) => (
              <BookCard key={book._id} className="vertical-item" variant={cardVariant} book={book} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="scroll-section">
      <div className="section-header">
        {(() => {
          const meta = getSectionMeta(title);
          return (
            <div className={`section-title-wrap ${meta.key || ''}`}>
              <h2 className="section-title">{title}{meta.badge && <span className="title-badge">{meta.badge}</span>}</h2>
              {meta.subtitle && <p className="section-subtitle">{meta.subtitle}</p>}
            </div>
          );
        })()}
      </div>

      <div className="scroll-container-wrapper">
        <button
          className={`scroll-arrow scroll-arrow-left ${canScrollLeft ? "" : "disabled"}`}
          onClick={() => scroll("left")}
          aria-label="Scroll left"
          disabled={!canScrollLeft}
        >
          ‹
        </button>

        <div
          className={`scroll-container ${compact ? "compact-gap" : ""}`}
          ref={scrollContainerRef}
          onScroll={handleScroll}
        >
          {books.map((book) => (
            <BookCard key={book._id} className="scroll-item" variant="carousel" book={book} />
          ))}
        </div>

        <button
          className={`scroll-arrow scroll-arrow-right ${canScrollRight ? "" : "disabled"}`}
          onClick={() => scroll("right")}
          aria-label="Scroll right"
          disabled={!canScrollRight}
        >
          ›
        </button>
      </div>
    </div>
  );
}
