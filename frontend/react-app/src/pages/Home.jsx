import { useEffect, useMemo, useState } from "react";
import { fetchBooks } from "../services/bookService";
import { useAuth } from "../context/AuthContext";
import { useXp } from "../context/XpContext";
import { useTheme } from "../context/ThemeContext";
import { io } from "socket.io-client";
import HeroBanner from "../components/HeroBanner";
import HorizontalScrollRow from "../components/HorizontalScrollRow";
import Footer from "../components/Footer";
import "../styles/home.css";

const MOOD_PRESETS = [
  { key: "focus", label: "Focus", icon: "🎯", description: "Deep-work books for concentration", keywords: ["productivity", "focus", "deep work", "self-help", "psychology", "business"], color: "#7c5cfc", gradient: "linear-gradient(135deg, #7c5cfc 0%, #3b82f6 100%)" },
  { key: "calm", label: "Calm", icon: "🌊", description: "Gentle reads for a relaxed mind", keywords: ["poetry", "philosophy", "romance", "drama", "travel", "art"], color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)" },
  { key: "growth", label: "Growth", icon: "🌱", description: "Career and mindset improvement picks", keywords: ["self-help", "motivation", "technology", "business", "education", "biography"], color: "#10b981", gradient: "linear-gradient(135deg, #10b981 0%, #f59e0b 100%)" },
  { key: "adventure", label: "Adventure", icon: "⚡", description: "Fast-paced stories and exciting journeys", keywords: ["adventure", "fantasy", "thriller", "mystery", "comic", "manga"], color: "#f43f5e", gradient: "linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)" },
];

function loadReadBooksForUser(email) {
  if (!email) return [];
  const key = `readBooks_${email}`;
  const saved = localStorage.getItem(key);
  if (!saved) return [];

  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => (
        typeof entry === "string"
          ? { bookId: entry, lastRead: 0, progress: 0 }
          : entry
      ))
      .filter((entry) => entry && entry.bookId);
  } catch {
    return [];
  }
}

export default function Home() {
  const { user } = useAuth();
  const { totalXp, streakDays, level, registerDailyVisit, registerMoodSelection } = useXp();
  const { mood, setMood } = useTheme();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [readBooks, setReadBooks] = useState([]);

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

          setBooks(booksArray);

          const email = user?.email;
          if (email) {
            setReadBooks(loadReadBooksForUser(email));
          }

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

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");
    socket.on("books:changed", () => {
      loadBooks();
    });

    return () => {
      socket.disconnect();
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  useEffect(() => {
    const email = user?.email;
    if (!email) return;

    let lastSerialized = JSON.stringify(loadReadBooksForUser(email));
    setReadBooks(JSON.parse(lastSerialized));

    const syncReadProgress = () => {
      const latest = loadReadBooksForUser(email);
      const serialized = JSON.stringify(latest);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        setReadBooks(latest);
      }
    };

    const intervalId = setInterval(syncReadProgress, 3000);
    const onStorage = (event) => {
      if (event.key && event.key !== `readBooks_${email}`) return;
      syncReadProgress();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncReadProgress);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncReadProgress);
    };
  }, [user?.email]);

  useEffect(() => {
    registerDailyVisit();
  }, [registerDailyVisit]);

  const moodConfig = useMemo(
    () => MOOD_PRESETS.find((moodPreset) => moodPreset.key === mood) || MOOD_PRESETS[0],
    [mood]
  );

  const personalizedBooks = useMemo(() => {
    if (!books.length) return [];
    const keywords = moodConfig.keywords.map((keyword) => keyword.toLowerCase());

    const scored = books.map((book) => {
      const categoryText = (book.category?.name || "").toLowerCase();
      const titleText = (book.title || "").toLowerCase();
      const descriptionText = (book.description || "").toLowerCase();
      const authorText = (book.author || "").toLowerCase();

      let score = 0;
      for (const keyword of keywords) {
        if (categoryText.includes(keyword)) score += 4;
        if (titleText.includes(keyword)) score += 3;
        if (descriptionText.includes(keyword)) score += 2;
        if (authorText.includes(keyword)) score += 1;
      }

      score += Number(book.rating || 0) * 0.8;
      score += Number(book.views || 0) / 400;
      return { ...book, __moodScore: score };
    });

    const topMatches = scored
      .filter((book) => book.__moodScore > 0)
      .sort((firstBook, secondBook) => secondBook.__moodScore - firstBook.__moodScore)
      .slice(0, 14)
      .map(({ __moodScore, ...book }) => book);

    if (topMatches.length > 0) return topMatches;
    return books.slice(0, 14);
  }, [books, moodConfig.keywords]);

  if (loading) {
    return (
      <div className="loading-container">
        <p className="loading-text">Loading your library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-card">
          <span className="error-icon">??</span>
          <p>Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!books || books.length === 0) {
    return (
      <div className="empty-container">
        <div className="empty-card">
          <span className="empty-icon">??</span>
          <p>No books available yet</p>
        </div>
      </div>
    );
  }

  const continueReadingBooks = books
    .filter((book) => readBooks.some((rb) => rb.bookId === book._id))
    .map((book) => {
      const rb = readBooks.find((r) => r.bookId === book._id) || {};
      return {
        ...book,
        progress: rb.progress || 0,
        lastPosition: rb.position || null,
        lastRead: rb.lastRead || 0,
      };
    })
    .sort((a, b) => b.lastRead - a.lastRead);

  const trendingBooks = books.slice(0, Math.ceil(books.length / 3));
  const motivationBooks = books.slice(Math.ceil(books.length / 3), Math.ceil((books.length * 2) / 3));
  const recommendedBooks = books.slice(Math.ceil((books.length * 2) / 3));

  const handleMoodSelection = (moodKey) => {
    setMood(moodKey);
    registerMoodSelection(moodKey);
  };

  return (
    <div className="home-root">
      <HeroBanner books={books} />
      <div className="home-wave" aria-hidden="true" />

      <div className="home-container">
        <div className="xp-strip">
          <div className="xp-card">
            <div className="xp-title">Level</div>
            <div className="xp-value">{level}</div>
            <div className="xp-sub">Total XP: {totalXp}</div>
          </div>
          <div className="xp-card">
            <div className="xp-title">Streak</div>
            <div className="xp-value">{streakDays} day{streakDays === 1 ? "" : "s"}</div>
            <div className="xp-sub">+15 XP daily login bonus</div>
          </div>
          <div className="xp-card mood-state">
            <div className="xp-title">Current Mood Feed</div>
            <div className="xp-value">{moodConfig.label}</div>
            <div className="xp-sub">{moodConfig.description}</div>
          </div>
        </div>

        <div className="mood-feed-block" style={{ '--mood-color': moodConfig.color }}>
          <div className="mood-feed-header">
            <h3>Your Mood-Based Feed</h3>
            <p>Pick your mood and get personalized recommendations instantly.</p>
          </div>

          <div className="mood-selector-grid">
            {MOOD_PRESETS.map((moodPreset, index) => (
              <button
                key={moodPreset.key}
                className={`mood-card ${mood === moodPreset.key ? "active" : ""}`}
                onClick={() => handleMoodSelection(moodPreset.key)}
                style={{
                  '--card-color': moodPreset.color,
                  '--card-gradient': moodPreset.gradient,
                  '--card-index': index,
                }}
              >
                <div className="mood-card-glow" />
                <div className="mood-card-particles">
                  <span /><span /><span /><span /><span /><span />
                </div>
                <div className="mood-card-icon">{moodPreset.icon}</div>
                <div className="mood-card-label">{moodPreset.label}</div>
                <div className="mood-card-desc">{moodPreset.description}</div>
                <div className="mood-card-indicator" />
              </button>
            ))}
          </div>

          <div className="mood-active-bar">
            <div className="mood-active-dot" style={{ background: moodConfig.color }} />
            <span className="mood-active-text">
              Currently vibing: <strong>{moodConfig.label}</strong>
            </span>
          </div>
        </div>

        <div className="section-wrapper">
          <HorizontalScrollRow
            title={`Personalized for your ${moodConfig.label} mood`}
            books={personalizedBooks}
            compact={false}
            variant="details"
            alignLeft={true}
          />
        </div>

        {continueReadingBooks.length > 0 && (
          <div className="section-wrapper">
            <HorizontalScrollRow
              title="Continue Reading"
              books={continueReadingBooks}
              showProgress={true}
              compact={true}
              variant="details"
            />
          </div>
        )}

        <div className="section-wrapper">
          <HorizontalScrollRow title="Trending Now" books={trendingBooks} compact={false} variant="details" alignLeft={true} />
        </div>

        <div className="section-wrapper">
          <HorizontalScrollRow title="Motivation & Self-Help" books={motivationBooks} compact={true} variant="details" alignLeft={true} />
        </div>

        <div className="section-wrapper">
          <HorizontalScrollRow title="Recommended for You" books={recommendedBooks} compact={true} variant="details" alignLeft={true} />
        </div>

        <div className="section-wrapper">
          <HorizontalScrollRow title="All Books" books={books} compact={false} variant="details" alignLeft={true} />
        </div>
      </div>

      <Footer />
    </div>
  );
}
