import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { fetchBookById } from "../services/bookService";
import { checkBookPurchased } from "../services/orderService";
import { API_BASE, BACKEND_URL } from "../config/api";
import "../styles/readBook.css";

const API = API_BASE;
const BACKEND = BACKEND_URL;

/* Normalise pdfUrl to a full URL */
function resolvePdf(pdfUrl) {
  if (!pdfUrl) return null;
  if (pdfUrl.startsWith("http")) return pdfUrl;
  return `${BACKEND}${pdfUrl.startsWith("/") ? "" : "/"}${pdfUrl}`;
}

/* AI Chat — sends a message to /api/chat */
async function sendChatMessage(messages, bookTitle) {
  const res = await fetch(`${API}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...((localStorage.getItem("token") || sessionStorage.getItem("token"))
        ? { Authorization: `Bearer ${localStorage.getItem("token") || sessionStorage.getItem("token")}` }
        : {}),
    },
    body: JSON.stringify({ messages, bookTitle }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Chat failed");
  return data.reply;
}

/* ── Helpers ── */
const genId = () => `s_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const truncate = (txt, n = 42) => (txt.length > n ? txt.slice(0, n) + "\u2026" : txt);
const toDayKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
function newSession() {
  return {
    id: genId(),
    title: "New Chat",
    createdAt: Date.now(),
    messages: [
      {
        role: "assistant",
        text: "Hi! I\u2019m your AI reading assistant. Ask me anything about this book \u2014 characters, themes, summaries, or anything else!",
      },
    ],
    pinned: false,
  };
}

/* ── SVG Icons ── */
const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
);
const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const IconSpeaker = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
);
const IconStop = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="6" width="12" height="12" rx="2" ry="2"/>
  </svg>
);
const IconPin = ({ filled }) => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.68V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3v4.68a2 2 0 0 1-1.11 1.87l-1.78.89A2 2 0 0 0 5 15.24Z"/>
  </svg>
);
const IconEdit = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9"/>
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
  </svg>
);
const IconTrash = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>
);
const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconPlus = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/>
    <line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
);
const IconSidebarToggle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
    <line x1="9" y1="3" x2="9" y2="21"/>
  </svg>
);

export default function ReadBook() {
  const { id } = useParams();
  const { user, initialized } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const [pdfZoom, setPdfZoom] = useState(100);
  const iframeRef = useRef(null);

  /* ── Chat history per user+book ── */
  const storageKey = user ? `dl_chat_${user.email || user._id}_${id}` : null;

  const loadSessions = () => {
    if (!storageKey) return [newSession()];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [newSession()];
  };

  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [historySidebarOpen, setHistorySidebarOpen] = useState(true);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [typingMessageKey, setTypingMessageKey] = useState(null);
  const [typingText, setTypingText] = useState("");
  const typedMessagesRef = useRef(new Set());
  const typingTimerRef = useRef(null);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  /* Derived */
  const currentSession = sessions.find((s) => s.id === currentSessionId) ?? sessions[0];
  const messages = currentSession?.messages ?? [];

  const sortedSessions = [...sessions].sort((a, b) => {
    if (a.pinned === b.pinned) return b.createdAt - a.createdAt;
    return a.pinned ? -1 : 1;
  });

  /* Cleanup speaking when component unmounts */
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) {
        speechSynthesis.cancel();
      }
    };
  }, []);

  /* Persist sessions */
  useEffect(() => {
    if (!storageKey || sessions.length === 0) return;
    localStorage.setItem(storageKey, JSON.stringify(sessions));
  }, [sessions, storageKey]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
      }
    };
  }, []);

  /* Init sessions once auth ready */
  useEffect(() => {
    if (!initialized) return;
    if (!user) { navigate("/login"); return; }
    const stored = loadSessions();
    setSessions(stored);
    setCurrentSessionId(stored[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, user, id]);

  /* Track book read in user's reading history (with progress data) */
  const trackBookRead = useCallback((bookId, progressIncrement = 0) => {
    if (!user?.email) return;
    const key = `readBooks_${user.email}`;
    try {
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      if (!Array.isArray(existing)) return;
      // Update or add entry with bookId + lastRead timestamp
      const idx = existing.findIndex(
        (r) => (typeof r === "object" ? r.bookId : r) === bookId
      );
      const previousEntry = idx >= 0 && typeof existing[idx] === "object" && existing[idx] !== null
        ? existing[idx]
        : null;
      const previousProgress = Number(previousEntry?.progress || 0);
      const nextProgress = Math.min(95, Math.max(0, previousProgress + Number(progressIncrement || 0)));
      const entry = { bookId, lastRead: Date.now(), progress: nextProgress };
      if (idx >= 0) {
        existing[idx] = entry;
      } else {
        if (entry.progress <= 0) entry.progress = 5;
        existing.push(entry);
      }
      localStorage.setItem(key, JSON.stringify(existing));
    } catch (err) {
      console.error("Error tracking read:", err);
    }
  }, [user?.email]);

  /* Load book + verify purchase */
  useEffect(() => {
    if (!initialized || !user) return;
    (async () => {
      try {
        setLoading(true);
        const [bookData, purchased] = await Promise.all([
          fetchBookById(id),
          checkBookPurchased(id),
        ]);
        if (!purchased) { setAccessDenied(true); setLoading(false); return; }
        setBook(bookData);
        // Track the read
        trackBookRead(id, 2);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, user, navigate, initialized, trackBookRead]);

  useEffect(() => {
    if (!initialized || !user || accessDenied || !id) return;

    const intervalId = setInterval(() => {
      trackBookRead(id, 1);
    }, 15000);

    const onFocus = () => trackBookRead(id, 1);
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [accessDenied, id, initialized, trackBookRead, user]);

  // Track daily reading time for XP tasks in real time.
  useEffect(() => {
    if (!initialized || !user?.email || accessDenied) return;

    const metricsKey = `readify_task_metrics_${user.email}`;

    const updateMetrics = (deltaSeconds = 0, opened = false) => {
      try {
        const dayKey = toDayKey();
        const parsed = JSON.parse(localStorage.getItem(metricsKey) || "{}");
        const existingDay = parsed[dayKey] && typeof parsed[dayKey] === "object" ? parsed[dayKey] : {};
        const nextDay = {
          ...existingDay,
          readSeconds: Math.max(0, Number(existingDay.readSeconds || 0) + Number(deltaSeconds || 0)),
          openedReadBook: Boolean(existingDay.openedReadBook || opened),
          updatedAt: Date.now(),
        };

        parsed[dayKey] = nextDay;
        localStorage.setItem(metricsKey, JSON.stringify(parsed));
      } catch {}
    };

    // Mark that reader was opened today.
    updateMetrics(0, true);

    const intervalId = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      updateMetrics(5, false);
    }, 5000);

    const handleVisible = () => {
      if (document.visibilityState === "visible") updateMetrics(0, true);
    };
    document.addEventListener("visibilitychange", handleVisible);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisible);
    };
  }, [accessDenied, initialized, user?.email]);

  /* Scroll chat to bottom */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  useEffect(() => {
    if (!messages.length || !currentSessionId) return;

    const lastIdx = messages.length - 1;
    const lastMsg = messages[lastIdx];
    const prevMsg = messages[lastIdx - 1];

    // Animate only fresh AI replies that come right after a user message.
    if (!(lastMsg?.role === "assistant" && prevMsg?.role === "user")) return;

    const msgKey = `${currentSessionId}_${lastIdx}_${lastMsg.text}`;
    if (typedMessagesRef.current.has(msgKey)) return;

    if (typingTimerRef.current) {
      clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    setTypingMessageKey(msgKey);
    setTypingText("");

    let cursor = 0;
    const fullText = lastMsg.text || "";
    typingTimerRef.current = setInterval(() => {
      cursor += 2;
      if (cursor >= fullText.length) {
        setTypingText(fullText);
        typedMessagesRef.current.add(msgKey);
        setTypingMessageKey(null);
        clearInterval(typingTimerRef.current);
        typingTimerRef.current = null;
        return;
      }
      setTypingText(fullText.slice(0, cursor));
    }, 12);
  }, [messages, currentSessionId]);

  /* ── Handlers ── */
  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || chatLoading) return;

    const userMsg = { role: "user", text };
    const currentMsgs = currentSession?.messages ?? [];
    const newMessages = [...currentMsgs, userMsg];
    const isFirstUserMsg = !currentMsgs.some((m) => m.role === "user");

    setSessions((prev) =>
      prev.map((s) =>
        s.id === currentSessionId
          ? { ...s, messages: newMessages, title: isFirstUserMsg ? truncate(text) : s.title }
          : s
      )
    );
    setInput("");
    setChatLoading(true);

    try {
      const historyForApi = newMessages.map((m) => ({ role: m.role, content: m.text }));
      const reply = await sendChatMessage(historyForApi, book?.title ?? "this book");
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, { role: "assistant", text: reply }] }
            : s
        )
      );
    } catch (err) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === currentSessionId
            ? { ...s, messages: [...s.messages, { role: "assistant", text: "\u26a0\ufe0f Sorry, I couldn\u2019t reach the AI right now. Please try again." }] }
            : s
        )
      );
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const startNewChat = () => {
    const s = newSession();
    setSessions((prev) => [s, ...prev]);
    setCurrentSessionId(s.id);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const switchSession = (sessionId) => {
    setCurrentSessionId(sessionId);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const togglePinSession = (sessionId, e) => {
    e.stopPropagation();
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, pinned: !s.pinned } : s))
    );
  };

  const startEditSession = (sessionId, currentTitle, e) => {
    e.stopPropagation();
    setEditingSessionId(sessionId);
    setEditingTitle(currentTitle);
  };

  const saveEditSession = (sessionId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: editingTitle.trim() || s.title } : s))
    );
    setEditingSessionId(null);
  };

  const deleteSession = (sessionId, e) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (next.length === 0) {
        const s = newSession();
        setCurrentSessionId(s.id);
        return [s];
      }
      if (currentSessionId === sessionId) setCurrentSessionId(next[0].id);
      return next;
    });
  };

  const copyMessage = async (text, idx) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx(null), 2000);
    } catch {}
  };

  const readMessage = (text, idx) => {
    if (!("speechSynthesis" in window)) return;
    
    // If currently speaking this message, stop it.
    if (speakingIdx === idx) {
      speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    
    speechSynthesis.cancel();
    setSpeakingIdx(idx);

    const utter = new SpeechSynthesisUtterance(text);
    /* Use user's saved voice preference */
    const savedName = localStorage.getItem("readify_voice");
    if (savedName) {
      const match = speechSynthesis.getVoices().find(v => v.name === savedName);
      if (match) utter.voice = match;
    }
    
    utter.onend = () => setSpeakingIdx(null);
    utter.onerror = () => setSpeakingIdx(null);

    speechSynthesis.speak(utter);
  };

  /* ── States ─────────────────────────── */
  if (loading) {
    return (
      <div className="rb-loading">
        <div className="rb-spinner" />
        <p>Opening your book…</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="rb-denied">
        <span className="rb-denied-icon">🔒</span>
        <h2>Purchase Required</h2>
        <p>You need to purchase this book before you can read it.</p>
        <Link to={`/book/${id}`} className="rb-buy-link">View Book &amp; Purchase</Link>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="rb-denied">
        <h2>Book not found</h2>
        <Link to="/app" className="rb-buy-link">Go Home</Link>
      </div>
    );
  }

  const pdfSrc = resolvePdf(book.pdfUrl);
  const userInitial =
    user?.name?.charAt(0).toUpperCase() ??
    user?.email?.charAt(0).toUpperCase() ??
    "U";
  const userPic = user?.profilePic ? `${BACKEND}${user.profilePic}` : null;

  return (
    <div className="rb-page">

      {/* ── Top bar ── */}
      <header className="rb-topbar">
        <div className="rb-topbar-left">
          <Link to={`/book/${id}`} className="rb-back-btn" title="Back to details">
            ← Back
          </Link>
          <div className="rb-book-info">
            <span className="rb-book-title">{book.title}</span>
            <span className="rb-book-author">by {book.author}</span>
          </div>
        </div>
        <div className="rb-topbar-right">
          <div className="rb-zoom-controls">
            <button className="rb-zoom-btn" onClick={() => setPdfZoom((z) => Math.max(50, z - 10))} title="Zoom out">−</button>
            <span className="rb-zoom-label">{pdfZoom}%</span>
            <button className="rb-zoom-btn" onClick={() => setPdfZoom((z) => Math.min(200, z + 10))} title="Zoom in">+</button>
          </div>
          <button
            className="rb-theme-toggle"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {theme === 'dark'
              ? <i className="fas fa-sun"></i>
              : <i className="fas fa-moon"></i>}
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="rb-body">

        {/* PDF Viewer */}
        <section className="rb-pdf-panel">
          {pdfSrc ? (
            <div className="rb-pdf-wrap" style={{ "--pdf-zoom": `${pdfZoom}%` }}>
              <iframe
                ref={iframeRef}
                src={pdfSrc}
                className="rb-pdf-iframe"
                title={book.title}
                onError={() => setPdfError(true)}
              />
              {pdfError && (
                <div className="rb-pdf-error">
                  <span>⚠️ Could not load PDF.</span>
                  <a href={pdfSrc} target="_blank" rel="noopener noreferrer" className="rb-buy-link">
                    Open in new tab
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="rb-pdf-error">
              <span>📄 No PDF attached to this book yet.</span>
              <p className="rb-pdf-hint">Add the PDF to <code>backend/public/pdfs/</code> and set <code>pdfUrl</code> in Admin.</p>
            </div>
          )}
        </section>

        {/* Chat Panel */}
        <aside className="rb-chat-panel">

          {/* History Sidebar */}
          <div className={`rb-history-sidebar${historySidebarOpen ? " rb-history-sidebar--open" : ""}`}>
            <div className="rb-history-header">
              <button className="rb-new-chat-btn" onClick={startNewChat}>
                <IconPlus />
                <span>New Chat</span>
              </button>
            </div>
            <div className="rb-history-label">Chat History</div>
            <div className="rb-history-list">
              {sortedSessions.map((s) => (
                <div
                  key={s.id}
                  className={`rb-history-item${s.id === currentSessionId ? " rb-history-item--active" : ""}`}
                  onClick={() => switchSession(s.id)}
                  title={s.title}
                >
                  <svg className="rb-history-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  
                  {editingSessionId === s.id ? (
                    <form 
                      className="rb-history-edit-form"
                      onSubmit={(e) => saveEditSession(s.id, e)}
                    >
                      <input
                        type="text"
                        autoFocus
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={(e) => saveEditSession(s.id, e)}
                        onClick={(e) => e.stopPropagation()}
                        className="rb-history-edit-input"
                      />
                    </form>
                  ) : (
                    <span className="rb-history-title">{s.title}</span>
                  )}

                  <div className="rb-history-actions">
                    <button
                      className={`rb-history-action-btn${s.pinned ? " rb-history-action-btn--pinned" : ""}`}
                      onClick={(e) => togglePinSession(s.id, e)}
                      title={s.pinned ? "Unpin chat" : "Pin chat"}
                    >
                      <IconPin filled={s.pinned} />
                    </button>
                    {editingSessionId !== s.id && (
                      <button
                        className="rb-history-action-btn"
                        onClick={(e) => startEditSession(s.id, s.title, e)}
                        title="Rename chat"
                      >
                        <IconEdit />
                      </button>
                    )}
                    <button
                      className="rb-history-action-btn rb-history-action-btn--delete"
                      onClick={(e) => deleteSession(s.id, e)}
                      title="Delete chat"
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="rb-history-footer">
              <div className="rb-history-avatar">{userPic ? <img src={userPic} alt="" className="rb-user-pic" /> : userInitial}</div>
              <span className="rb-history-email">{user?.name ?? user?.email ?? "You"}</span>
            </div>
          </div>

          {/* Main Chat Area */}
          <div className="rb-chat-main">

            {/* Chat Header */}
            <div className="rb-chat-header">
              <button
                className="rb-sidebar-toggle"
                onClick={() => setHistorySidebarOpen((v) => !v)}
                title={historySidebarOpen ? "Collapse history" : "Show history"}
              >
                <IconSidebarToggle />
              </button>
              <div className="rb-chat-header-avatar">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 8v4l3 3"/>
                </svg>
              </div>
              <div className="rb-chat-header-info">
                <h3 className="rb-chat-title">AI Reading Assistant</h3>
                <p className="rb-chat-subtitle" title={book.title}>{book.title}</p>
              </div>
              <span className="rb-chat-live"><span className="rb-live-dot" />&nbsp;Live</span>
            </div>

            {/* Messages */}
            <div className="rb-chat-messages">
              {messages.map((msg, i) => (
                <div key={i} className={`rb-msg rb-msg-${msg.role}`}>
                  {(() => {
                    const messageKey = `${currentSessionId}_${i}_${msg.text}`;
                    const isTyping = msg.role === "assistant" && typingMessageKey === messageKey;
                    return (
                      <>
                  {msg.role === "assistant" && (
                    <div className="rb-msg-avatar rb-msg-ai-avatar">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v4l3 3"/>
                      </svg>
                    </div>
                  )}
                  {msg.role === "user" && (
                    <div className="rb-msg-avatar rb-msg-user-avatar">
                      {userPic ? <img src={userPic} alt="" className="rb-user-pic" /> : userInitial}
                    </div>
                  )}
                  <div className="rb-msg-content">
                    <div className={`rb-msg-bubble${isTyping ? " rb-msg-bubble--typing" : ""}`}>{isTyping ? typingText : msg.text}</div>
                    <div className="rb-msg-actions">
                      <button
                        className={`rb-action-btn${copiedIdx === i ? " rb-action-btn--done" : ""}`}
                        onClick={() => copyMessage(msg.text, i)}
                        title="Copy"
                      >
                        {copiedIdx === i ? <><IconCheck /><span>Copied</span></> : <><IconCopy /><span>Copy</span></>}
                      </button>
                      <button
                        className={`rb-action-btn${speakingIdx === i ? " rb-action-btn--speaking" : ""}`}
                        onClick={() => readMessage(msg.text, i)}
                        title={speakingIdx === i ? "Stop reading" : "Read aloud"}
                      >
                        {speakingIdx === i ? <><IconStop /><span>Stop</span></> : <><IconSpeaker /><span>Read</span></>}
                      </button>
                    </div>
                  </div>
                      </>
                    );
                  })()}
                </div>
              ))}

              {/* Animated loading indicator */}
              {chatLoading && (
                <div className="rb-msg rb-msg-assistant">
                  <div className="rb-msg-avatar rb-msg-ai-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v4l3 3"/>
                    </svg>
                  </div>
                  <div className="rb-msg-content">
                    <div className="rb-msg-bubble rb-loading-bubble">
                      <span className="rb-loading-dots">
                        <span /><span /><span />
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input */}
            <div className="rb-input-area">
              <form className="rb-input-form" onSubmit={handleSend}>
                <textarea
                  ref={inputRef}
                  className="rb-chat-input"
                  placeholder="Ask anything about this book…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  maxLength={800}
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  className={`rb-chat-send${input.trim() && !chatLoading ? " rb-chat-send--active" : ""}`}
                  disabled={!input.trim() || chatLoading}
                  title="Send (Enter)"
                >
                  <IconSend />
                </button>
              </form>
              <p className="rb-chat-hint">Enter to send &middot; Shift+Enter for new line</p>
            </div>

          </div>
        </aside>

      </div>
    </div>
  );
}

