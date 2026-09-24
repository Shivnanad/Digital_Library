import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { searchBooksWithFilters } from "../services/bookService";
import "../styles/searchResults.css";

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "newest",    label: "Newest First" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc",label: "Price: High to Low" },
  { value: "rating",    label: "Top Rated" },
  { value: "popular",   label: "Most Popular" },
];

const CATEGORY_OPTIONS = [
  "Business", "Technology", "Fiction", "Self-Help",
  "Science", "History", "Biography", "Psychology",
  "Education", "Romance", "Mystery", "Fantasy",
];

const PRICE_RANGES = [
  { label: "All Prices", min: "", max: "" },
  { label: "Under ₹100", min: "", max: 100 },
  { label: "₹100 – ₹300", min: 100, max: 300 },
  { label: "₹300 – ₹500", min: 300, max: 500 },
  { label: "₹500 – ₹1000", min: 500, max: 1000 },
  { label: "Above ₹1000", min: 1000, max: "" },
];

const LIMIT = 12;

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const query    = searchParams.get("q") || "";
  const page     = Number(searchParams.get("page") || 1);
  const sort     = searchParams.get("sort") || "relevance";
  const category = searchParams.get("category") || "";
  const minPrice = searchParams.get("minPrice") || "";
  const maxPrice = searchParams.get("maxPrice") || "";
  const availability = searchParams.get("availability") || "all";

  const [results, setResults]       = useState([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");
  const [inputVal, setInputVal]     = useState(query);
  const [didYouMean, setDidYouMean] = useState(null);   // spell suggestion
  const [corrected, setCorrected]   = useState(false);  // was auto-corrected
  const [usedQuery, setUsedQuery]   = useState(query);  // actual query used
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // ── Initialise Web Speech API ──
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onstart  = () => setIsListening(true);
    rec.onend    = () => setIsListening(false);
    rec.onerror  = () => setIsListening(false);
    rec.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) transcript += event.results[i][0].transcript;
      }
      const term = transcript.trim();
      if (!term) return;
      setInputVal(term);
      const next = new URLSearchParams();
      next.set("q", term);
      next.set("page", "1");
      setSearchParams(next);
    };
    recognitionRef.current = rec;
  }, [setSearchParams]);

  const handleVoiceSearch = () => {
    const rec = recognitionRef.current;
    if (!rec) { alert("Voice search not supported in this browser. Please use Chrome, Edge, or Safari."); return; }
    if (isListening) { rec.stop(); setIsListening(false); }
    else { setInputVal(""); rec.start(); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    setDidYouMean(null);
    setCorrected(false);
    try {
      const data = await searchBooksWithFilters({
        query, page, limit: LIMIT, sort, category,
        minPrice: minPrice !== "" ? Number(minPrice) : undefined,
        maxPrice: maxPrice !== "" ? Number(maxPrice) : undefined,
        availability,
      });
      setResults(data.books || []);
      setTotal(data.total || 0);
      setDidYouMean(data.didYouMean || null);
      setCorrected(data.corrected || false);
      setUsedQuery(data.usedQuery || query);
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [query, page, sort, category, minPrice, maxPrice, availability]);

  useEffect(() => { doSearch(); }, [doSearch]);
  useEffect(() => { setInputVal(query); }, [query]);

  // ── helpers to mutate URL params ──
  const setParam = (key, val) => {
    const next = new URLSearchParams(searchParams);
    if (val === "" || val === null || val === undefined) next.delete(key);
    else next.set(key, val);
    if (key !== "page") next.set("page", "1");
    setSearchParams(next);
  };

  const setPageParam = (p) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", p);
    setSearchParams(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!inputVal.trim()) return;
    const next = new URLSearchParams();
    next.set("q", inputVal.trim());
    next.set("page", "1");
    setSearchParams(next);
  };

  const clearAllFilters = () => {
    const next = new URLSearchParams();
    next.set("q", query);
    next.set("page", "1");
    setSearchParams(next);
  };

  const isPriceRangeActive = (r) =>
    String(minPrice) === String(r.min === "" ? "" : r.min) &&
    String(maxPrice) === String(r.max === "" ? "" : r.max);

  const hasFilters = category || minPrice || maxPrice || availability !== "all" || (sort && sort !== "relevance");

  return (
    <div className="sr-page">
      {/* ── Top search bar ── */}
      <div className="sr-topbar">
        <div className="sr-topbar-inner">
          <form className="sr-search-form" onSubmit={handleSearchSubmit}>
            <input
              className="sr-search-input"
              type="search"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={isListening ? "🎤 Listening…" : "Search books, authors, topics…"}
            />
            <button
              type="button"
              className={`sr-voice-btn${isListening ? " sr-voice-listening" : ""}`}
              onClick={handleVoiceSearch}
              title={isListening ? "Stop listening" : "Search by voice"}
              aria-label="Voice search"
            >
              <i className="fas fa-microphone"></i>
            </button>
            <button type="submit" className="sr-search-btn">
              <i className="fas fa-search"></i> Search
            </button>
          </form>
        </div>
      </div>

      <div className="sr-layout">
        {/* ══════════════ LEFT SIDEBAR — FILTERS ══════════════ */}
        <aside className="sr-sidebar">
          <div className="sr-sidebar-header">
            <span className="sr-filter-title"><i className="fas fa-sliders-h"></i> Filters</span>
            {hasFilters && (
              <button className="sr-clear-btn" onClick={clearAllFilters}>Clear All</button>
            )}
          </div>

          {/* Sort */}
          <div className="sr-filter-group">
            <div className="sr-filter-group-title">Sort By</div>
            {SORT_OPTIONS.map((opt) => (
              <label key={opt.value} className={`sr-radio-label ${sort === opt.value ? "active" : ""}`}>
                <input
                  type="radio"
                  name="sort"
                  value={opt.value}
                  checked={sort === opt.value}
                  onChange={() => setParam("sort", opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>

          {/* Category */}
          <div className="sr-filter-group">
            <div className="sr-filter-group-title">Category</div>
            <label className={`sr-radio-label ${!category ? "active" : ""}`}>
              <input
                type="radio"
                name="category"
                value=""
                checked={!category}
                onChange={() => setParam("category", "")}
              />
              All Categories
            </label>
            {CATEGORY_OPTIONS.map((cat) => (
              <label key={cat} className={`sr-radio-label ${category === cat ? "active" : ""}`}>
                <input
                  type="radio"
                  name="category"
                  value={cat}
                  checked={category === cat}
                  onChange={() => setParam("category", cat)}
                />
                {cat}
              </label>
            ))}
          </div>

          {/* Price Range */}
          <div className="sr-filter-group">
            <div className="sr-filter-group-title">Price Range</div>
            {PRICE_RANGES.map((r) => (
              <label key={r.label} className={`sr-radio-label ${isPriceRangeActive(r) ? "active" : ""}`}>
                <input
                  type="radio"
                  name="priceRange"
                  checked={isPriceRangeActive(r)}
                  onChange={() => {
                    const next = new URLSearchParams(searchParams);
                    if (r.min === "") next.delete("minPrice"); else next.set("minPrice", r.min);
                    if (r.max === "") next.delete("maxPrice"); else next.set("maxPrice", r.max);
                    next.set("page", "1");
                    setSearchParams(next);
                  }}
                />
                {r.label}
              </label>
            ))}
          </div>

          {/* Availability */}
          <div className="sr-filter-group">
            <div className="sr-filter-group-title">Availability</div>
            <label className={`sr-radio-label ${availability === "all" ? "active" : ""}`}>
              <input
                type="radio"
                name="availability"
                value="all"
                checked={availability === "all"}
                onChange={() => setParam("availability", "")}
              />
              All
            </label>
            <label className={`sr-radio-label ${availability === "in-stock" ? "active" : ""}`}>
              <input
                type="radio"
                name="availability"
                value="in-stock"
                checked={availability === "in-stock"}
                onChange={() => setParam("availability", "in-stock")}
              />
              In Stock
            </label>
            <label className={`sr-radio-label ${availability === "out-of-stock" ? "active" : ""}`}>
              <input
                type="radio"
                name="availability"
                value="out-of-stock"
                checked={availability === "out-of-stock"}
                onChange={() => setParam("availability", "out-of-stock")}
              />
              Out of Stock
            </label>
          </div>
        </aside>

        {/* ══════════════ MAIN RESULTS AREA ══════════════ */}
        <main className="sr-main">

          {/* ── Auto-corrected banner ── */}
          {!loading && corrected && (
            <div className="sr-corrected-banner">
              <i className="fas fa-spell-check"></i>
              Showing results for <strong className="sr-query-text">{usedQuery}</strong>
              &nbsp;—&nbsp;
              <button
                className="sr-original-btn"
                onClick={() => {
                  const next = new URLSearchParams();
                  next.set("q", query);
                  next.set("page", "1");
                  next.set("noCorrect", "1");
                  setSearchParams(next);
                }}
              >
                Search instead for <em>{query}</em>
              </button>
            </div>
          )}

          {/* ── Did you mean? banner (suggestion but not auto-corrected) ── */}
          {!loading && !corrected && didYouMean && total === 0 && (
            <div className="sr-did-you-mean">
              <i className="fas fa-lightbulb"></i>
              Did you mean:&nbsp;
              <button
                className="sr-dym-btn"
                onClick={() => {
                  const next = new URLSearchParams(searchParams);
                  next.set("q", didYouMean);
                  next.set("page", "1");
                  setSearchParams(next);
                }}
              >
                {didYouMean}
              </button>
              ?
            </div>
          )}

          {/* Results header */}
          <div className="sr-results-header">
            {query && (
              <div className="sr-results-info">
                {loading ? (
                  <span>Searching for <strong>"{query}"</strong>…</span>
                ) : (
                  <span>
                    {total > 0
                      ? <><strong>{total}</strong> result{total !== 1 ? "s" : ""} for <strong className="sr-query-text">"{corrected ? usedQuery : query}"</strong></>
                      : <>No results found for <strong className="sr-query-text">"{query}"</strong></>
                    }
                  </span>
                )}
              </div>
            )}
          </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="sr-active-chips">
                {category && (
                  <span className="sr-chip">
                    {category}
                    <button onClick={() => setParam("category", "")} aria-label="Remove category filter">×</button>
                  </span>
                )}
                {(minPrice || maxPrice) && (
                  <span className="sr-chip">
                    {minPrice && maxPrice ? `₹${minPrice}–₹${maxPrice}` : minPrice ? `₹${minPrice}+` : `Up to ₹${maxPrice}`}
                    <button onClick={() => { setParam("minPrice", ""); setParam("maxPrice", ""); }} aria-label="Remove price filter">×</button>
                  </span>
                )}
                {availability !== "all" && (
                  <span className="sr-chip">
                    {availability === "out-of-stock" ? "Out of Stock" : "In Stock"}
                    <button onClick={() => setParam("availability", "")} aria-label="Remove availability filter">×</button>
                  </span>
                )}
                {sort && sort !== "relevance" && (
                  <span className="sr-chip">
                    {SORT_OPTIONS.find(o => o.value === sort)?.label}
                    <button onClick={() => setParam("sort", "relevance")} aria-label="Remove sort filter">×</button>
                  </span>
                )}
              </div>
            )}

          {/* Loading skeleton */}
          {loading && (
            <div className="sr-grid">
              {Array.from({ length: LIMIT }).map((_, i) => (
                <div key={i} className="sr-skeleton-card">
                  <div className="sr-skeleton-img pulse"></div>
                  <div className="sr-skeleton-line pulse" style={{ width: "80%" }}></div>
                  <div className="sr-skeleton-line pulse" style={{ width: "55%" }}></div>
                  <div className="sr-skeleton-line pulse" style={{ width: "35%" }}></div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="sr-empty">
              <i className="fas fa-exclamation-circle sr-empty-icon"></i>
              <p>{error}</p>
              <button className="sr-retry-btn" onClick={doSearch}>Retry</button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && results.length === 0 && query && (
            <div className="sr-empty">
              <i className="fas fa-search sr-empty-icon"></i>
              <h3>No books found</h3>
              <p>We couldn't find any books matching <strong>"{query}"</strong>.</p>
              <ul className="sr-suggestions-list">
                <li>Check your spelling</li>
                <li>Try more general keywords</li>
                <li>Try a different category filter</li>
                <li>Browse our <Link to="/categories">categories</Link> instead</li>
              </ul>
            </div>
          )}

          {/* Results grid */}
          {!loading && !error && results.length > 0 && (
            <div className="sr-grid">
              {results.map((book) => (
                <SearchBookCard key={book._id} book={book} />
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="sr-pagination">
              <button
                className="sr-pg-btn"
                disabled={page <= 1}
                onClick={() => setPageParam(page - 1)}
              >
                <i className="fas fa-chevron-left"></i> Prev
              </button>

              <div className="sr-pg-pages">
                {buildPageNumbers(page, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className="sr-pg-ellipsis">…</span>
                  ) : (
                    <button
                      key={p}
                      className={`sr-pg-num ${p === page ? "sr-pg-active" : ""}`}
                      onClick={() => setPageParam(p)}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                className="sr-pg-btn"
                disabled={page >= totalPages}
                onClick={() => setPageParam(page + 1)}
              >
                Next <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ── Inline book card for search results ── */
function SearchBookCard({ book }) {
  const coverUrl = book.coverUrl || book.cover || "/default-cover.svg";
  const catName  = typeof book.category === "object" ? book.category?.name : book.category;
  const isOutOfStock = book?.inStock === false;
  const CardTag = isOutOfStock ? "div" : Link;
  const cardProps = isOutOfStock
    ? { className: "sr-book-card sr-book-card-disabled", title: `${book.title} (Out of stock)` }
    : { to: `/book/${book._id}`, className: "sr-book-card", title: book.title };

  return (
    <CardTag {...cardProps}>
      <div className="sr-book-img-wrap">
        <img
          src={coverUrl}
          alt={book.title}
          className="sr-book-img"
          onError={(e) => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = "/default-cover.svg";
          }}
        />
      </div>
      <div className="sr-book-body">
        <p className="sr-book-cat">{catName || "General"}</p>
        {isOutOfStock && <span className="sr-stock-badge">Out of Stock</span>}
        <h3 className="sr-book-title">{book.title}</h3>
        <p className="sr-book-author">{book.author}</p>
        {book.rating > 0 && (
          <div className="sr-book-rating">
            <span className="sr-stars">{"★".repeat(Math.round(book.rating))}{"☆".repeat(5 - Math.round(book.rating))}</span>
            <span className="sr-rating-val">{Number(book.rating).toFixed(1)}</span>
          </div>
        )}
        <div className="sr-book-price">
          {book.price > 0 ? `₹${book.price}` : "Free"}
        </div>
        <button className="sr-view-btn" disabled={isOutOfStock}>{isOutOfStock ? "Unavailable" : "View Details"}</button>
      </div>
    </CardTag>
  );
}

/* ── Build pagination page numbers with ellipsis ── */
function buildPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  pages.push(1);
  if (current > 3) pages.push("…");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("…");
  pages.push(total);
  return pages;
}
