import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "../context/AuthContext";
import { useVoice } from "../context/VoiceContext";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { getPurchasedBooks } from "../services/orderService";
import {
  uploadProfilePic,
  removeProfilePic,
  sendPasswordChangeOtp,
  verifyPasswordChangeOtp,
  updatePasswordWithOtp,
} from "../services/authService";
import { useXp } from "../context/XpContext";
import { fetchBooks } from "../services/bookService";
import "../styles/account.css";

/* ─── helpers ─── */
function getReadCount(userEmail) {
  try {
    const key = userEmail ? `readBooks_${userEmail}` : "readBooks";
    const a = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(a) ? a.length : 0;
  } catch { return 0; }
}
function getPurchasedCount() {
  try {
    const a = JSON.parse(localStorage.getItem("readify_orders") || "[]");
    return Array.isArray(a) ? a.reduce((s, o) => s + (Array.isArray(o.items) ? o.items.length : 0), 0) : 0;
  } catch { return 0; }
}
function getInitials(name) {
  if (!name) return "R";
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hashString(input) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailyRandomXpPrice(bookId, dayKey) {
  const minimum = 5000;
  const maximum = 100000;
  const span = maximum - minimum;
  const seed = hashString(`${bookId || "book"}-${dayKey}`);
  return minimum + (seed % (span + 1));
}

function getResetCountdownText(nowMs) {
  const now = new Date(nowMs);
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const remaining = Math.max(0, tomorrow.getTime() - nowMs);
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getTaskMetrics(userEmail, dayKey) {
  if (!userEmail || !dayKey) return { readSeconds: 0, openedReadBook: false };
  try {
    const raw = localStorage.getItem(`readify_task_metrics_${userEmail}`);
    const parsed = raw ? JSON.parse(raw) : {};
    const day = parsed?.[dayKey] && typeof parsed[dayKey] === "object" ? parsed[dayKey] : {};
    return {
      readSeconds: Math.max(0, Number(day.readSeconds || 0)),
      openedReadBook: Boolean(day.openedReadBook),
    };
  } catch {
    return { readSeconds: 0, openedReadBook: false };
  }
}

function getSupportBotReply(questionText) {
  const text = String(questionText || "").toLowerCase();

  if (/refund|return|cancel.*order/.test(text)) {
    return "For refunds: open your order details, share order ID, and explain the issue. Digital books that were already fully accessed are usually non-refundable, but our team can still review exceptions.";
  }
  if (/account.*lost|lost.*account|can't login|cant login|locked|hack|hacked|security|otp/.test(text)) {
    return "For account security issues: immediately reset password, verify email OTP, and remove unknown sessions. If you think your account is compromised, type 'I want to talk with customer support' for urgent live help.";
  }
  if (/order|payment|charged|upi|failed payment/.test(text)) {
    return "For order/payment issues: share order ID, payment method, and payment time. We can trace pending transactions and fix stuck purchases quickly.";
  }
  if (/playlist|wishlist|library|book.*missing/.test(text)) {
    return "For missing books in Library/Playlist: refresh the app, check your purchased list, and confirm the same email is logged in. If still missing, we can manually verify your account records.";
  }
  return "I can help with refunds, order issues, account security, lost account access, and reading problems. Ask me anything, or type 'I want to talk with customer support' to connect to a live agent.";
}

function formatAudioTime(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min)}:${String(sec).padStart(2, "0")}`;
}

function createSupportWelcomeMessage() {
  return {
    id: `support-welcome-${Date.now()}`,
    senderType: "bot",
    senderName: "Readify AI Support",
    messageType: "text",
    text: "Hi, how can I help you today? You can ask about refunds, order issues, account security, or lost account access.",
    createdAt: new Date().toISOString(),
  };
}

function VoiceNotePlayer({ audioUrl, durationSec = 0 }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(Number(durationSec || 0));

  useEffect(() => {
    setCurrentTime(0);
    setPlaying(false);
  }, [audioUrl]);

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const mediaDuration = Number(audio.duration || 0);
    if (mediaDuration > 0 && Number.isFinite(mediaDuration)) {
      setTotalTime(Math.round(mediaDuration));
    }
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime || 0);
  };

  const onEnded = () => {
    setPlaying(false);
    setCurrentTime(0);
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    audio.play().then(() => {
      setPlaying(true);
    }).catch(() => {
      setPlaying(false);
    });
  };

  const onSeek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.target.value || 0);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const effectiveDuration = Math.max(1, Math.floor(totalTime || durationSec || 1));

  return (
    <div className="acc-support-voice-player">
      <audio
        ref={audioRef}
        preload="metadata"
        src={audioUrl}
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
      />
      <button className="acc-support-voice-play" onClick={togglePlay} title={playing ? "Pause" : "Play"}>
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 6h3v12H8zm5 0h3v12h-3z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min="0"
        max={effectiveDuration}
        step="0.1"
        value={Math.min(currentTime, effectiveDuration)}
        onChange={onSeek}
        className="acc-support-voice-progress"
      />
      <div className="acc-support-voice-time">{formatAudioTime(currentTime)} / {formatAudioTime(effectiveDuration)}</div>
    </div>
  );
}

/* ─── icon component ─── */
const Icon = ({ d, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  orders:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  wishlist: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
  playlist: "M9 18V5l12-2v13M9 18a3 3 0 01-6 0 3 3 0 016 0zm12-2a3 3 0 01-6 0 3 3 0 016 0z",
  history:  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z",
  cart:     "M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0",
  security: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  notif:    "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  privacy:  "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
  help:     "M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01",
  about:    "M12 2a10 10 0 110 20A10 10 0 0112 2zm0 8v8m0-10v.01",
  logout:   "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  chevron:  "M9 18l6-6-6-6",
  edit:     "M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3",
  theme:    "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  voice:    "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zM17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z",
  speaker:  "M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07",
  xp:       "M12 2l2.4 5.2L20 8l-4 3.8.9 5.7L12 15l-4.9 2.5L8 11.8 4 8l5.6-.8L12 2z",
};

const DAILY_XP_TASKS = [
  { id: "read-20", title: "Read for 20 minutes", reward: 120 },
  { id: "read-35", title: "Read for 35 minutes", reward: 170 },
  { id: "wishlist-add", title: "Add one book to wishlist", reward: 90 },
  { id: "discover-book", title: "Open a new book detail page", reward: 100 },
  { id: "review-line", title: "Write a short review note", reward: 140 },
  { id: "share-book", title: "Share one book with a friend", reward: 110 },
  { id: "playlist-add", title: "Add one book to your playlist", reward: 95 },
  { id: "profile-check", title: "Visit your profile settings", reward: 80 },
  { id: "category-explore", title: "Explore one new category", reward: 105 },
  { id: "library-visit", title: "Open your library and continue reading", reward: 115 },
];

function getPreviousDayKey(dayKey) {
  const date = new Date(`${dayKey}T00:00:00`);
  date.setDate(date.getDate() - 1);
  return toDayKey(date);
}

function seededShuffle(items, seedText) {
  const shuffled = [...items];
  let seed = hashString(seedText || "seed");
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function getDailyTaskSet(dayKey) {
  const count = 3;
  const todayPool = seededShuffle(DAILY_XP_TASKS, `tasks:${dayKey}`);
  const initialToday = todayPool.slice(0, count);

  const yesterdayKey = getPreviousDayKey(dayKey);
  const yesterdaySet = seededShuffle(DAILY_XP_TASKS, `tasks:${yesterdayKey}`).slice(0, count);
  const yesterdayIds = new Set(yesterdaySet.map((task) => task.id));

  const noOverlap = initialToday.filter((task) => !yesterdayIds.has(task.id));
  if (noOverlap.length >= count) return noOverlap.slice(0, count);

  const fillers = todayPool.filter((task) => !yesterdayIds.has(task.id) && !noOverlap.some((picked) => picked.id === task.id));
  const combined = [...noOverlap, ...fillers];

  if (combined.length >= count) return combined.slice(0, count);
  return todayPool.slice(0, count);
}

/* ─── quick-access tiles ─── */
const QUICK_TILES = [
  { id: "orders",   icon: "orders",   label: "My Library",      desc: "Every purchase unlocks a new chapter — yours forever",  color: "#f59e0b", route: "/my-library" },
  { id: "wishlist", icon: "wishlist", label: "Wishlist",         desc: "Books saved for later",       color: "#ec4899", route: "/wishlist" },
  { id: "playlist", icon: "playlist", label: "Playlists",        desc: "Curated reading collections", color: "#8b5cf6", route: "/playlists" },
  { id: "history",  icon: "history",  label: "Reading History",  desc: "Books you've opened before",  color: "#06b6d4", route: "/reading-history" },
  { id: "cart",     icon: "cart",     label: "Cart",             desc: "Review items in your cart",   color: "#10b981", route: "/cart" },
];

/* ─── settings rows ─── */
const SETTING_ROWS = [
  { icon: "security", label: "Password & Security",  desc: "Change password, two-step verification" },
  { icon: "xp",       label: "XP Wallet & Redeem",   desc: "Daily tasks, wallet balance, unlock books" },
  { icon: "voice",    label: "Voice Settings",        desc: "Choose your Readify assistant voice" },
  { icon: "notif",    label: "Notifications",         desc: "Choose what you hear about" },
  { icon: "privacy",  label: "Privacy Settings",      desc: "Control your data & visibility" },
  { icon: "theme",    label: "Appearance",            desc: "Theme, font size, display options" },
  { icon: "about",    label: "About Readify",         desc: "Version, licences, terms" },
  { icon: "help",     label: "Help & Support",        desc: "FAQs, contact us, report an issue" },
];

/* ═══════════════════════════════════════════════════════════ */
export default function Account() {
  const NOTIF_DEFAULTS = {
    email: true,
    promos: false,
    newBook: true,
  };

  const { user, logout, updateProfilePic } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { pauseRecognition: voicePause, resumeRecognition: voiceResume } = useVoice();
  const {
    totalXp,
    walletXp,
    level,
    claimDailyTask,
    canClaimDailyTask,
    redeemBookWithXp,
  } = useXp();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [readCount, setReadCount]           = useState(0);
  const [purchasedCount, setPurchasedCount] = useState(0);
  const [activeSection, setActiveSection]   = useState(null);
  const [supportChatOpen, setSupportChatOpen] = useState(false);
  const [supportInput, setSupportInput] = useState("");
  const [supportMode, setSupportMode] = useState("ai");
  const [supportConversationId, setSupportConversationId] = useState("");
  const [supportAgentName, setSupportAgentName] = useState("");
  const [supportConnecting, setSupportConnecting] = useState(false);
  const [supportRecording, setSupportRecording] = useState(false);
  const [supportRecordElapsed, setSupportRecordElapsed] = useState(0);
  const [supportMicError, setSupportMicError] = useState("");
  const [supportMessages, setSupportMessages] = useState([createSupportWelcomeMessage()]);
  const [uploadingPic, setUploadingPic]     = useState(false);
  const [picMsg, setPicMsg]                 = useState("");

  /* change-password state */
  const [oldPwd, setOldPwd]         = useState("");
  const [newPwd, setNewPwd]         = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [msg, setMsg]               = useState("");
  const [securityStep, setSecurityStep] = useState("human");
  const [humanChecked, setHumanChecked] = useState(false);
  const [humanA, setHumanA] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [humanB, setHumanB] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [humanAnswer, setHumanAnswer] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);

  /* notification toggles */
  const [notifEmail,   setNotifEmail]   = useState(true);
  const [notifPromos,  setNotifPromos]  = useState(false);
  const [notifNewBook, setNotifNewBook] = useState(true);
  const [notifReady, setNotifReady]     = useState(false);

  /* voice settings */
  const [voices, setVoices]               = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(localStorage.getItem("readify_voice") || "");
  const [previewingIdx, setPreviewingIdx] = useState(-1);
  const [voiceFilter, setVoiceFilter]     = useState("");
  const previewSessionRef = useRef(0);          // bumped on every preview/stop to ignore stale callbacks
  const safetyTimerRef    = useRef(null);       // auto-reset if voice never starts
  const [redeemBooks, setRedeemBooks]           = useState([]);
  const [loadingRedeemBooks, setLoadingRedeemBooks] = useState(false);
  const [redeemMsg, setRedeemMsg]               = useState("");
  const [rewardClock, setRewardClock]           = useState(() => Date.now());
  const supportSocketRef = useRef(null);
  const supportEndRef = useRef(null);
  const supportRecorderRef = useRef(null);
  const supportRecordChunksRef = useRef([]);
  const supportRecordStartRef = useRef(0);
  const supportRecordStreamRef = useRef(null);
  const notifStorageKey = useMemo(() => {
    const email = user?.email || "guest";
    return `readify_notif_${email}`;
  }, [user?.email]);

  /* ── Curated voices — covers Edge (Online Natural), Chrome (Google + Desktop), macOS ── */
  const CURATED_VOICES = [
    /* ── Google voices (Chrome on all platforms) ── */
    { match: /^google\s+us\s+english$/i,                            displayName: "Google US",     tone: "Natural & Neutral",    accent: "American" },
    { match: /^google\s+uk\s+english\s+female$/i,                   displayName: "Google UK",     tone: "Classic & Clear",      accent: "British" },
    { match: /^google\s+uk\s+english\s+male$/i,                     displayName: "Google UK Male",tone: "Deep & Classic",       accent: "British" },
    { match: /google.*\b(hindi|हिन्दी)/i,                           displayName: "Google Hindi",  tone: "Warm & Expressive",    accent: "Indian",   previewText: "नमस्ते, मैं आपका रीडिफ़ाई साथी हूँ।" },
    { match: /google.*\b(español|spanish)/i,                        displayName: "Google Español",tone: "Vibrant & Flowing",    accent: "Spanish",  previewText: "Hola, soy tu compañero de lectura Readify." },
    { match: /google.*\b(français|french)/i,                        displayName: "Google Français",tone: "Elegant & Melodic",   accent: "French",   previewText: "Bonjour, je suis votre compagnon Readify." },
    { match: /google.*\b(deutsch|german)/i,                         displayName: "Google Deutsch",tone: "Precise & Strong",     accent: "German",   previewText: "Hallo, ich bin Ihr Readify-Begleiter." },
    { match: /google.*\b(italiano|italian)/i,                       displayName: "Google Italiano",tone: "Rhythmic & Warm",     accent: "Italian",  previewText: "Ciao, sono il tuo compagno di lettura Readify." },
    { match: /google.*(japanese|日本語)/i,                        displayName: "Google 日本語", tone: "Polite & Smooth",      accent: "Japanese", previewText: "こんにちは、Readifyの読書パートナーです。" },
    { match: /google.*\b(português|portuguese).*brazil/i,           displayName: "Google PT-BR",  tone: "Lively & Friendly",    accent: "Brazilian",previewText: "Olá, sou seu companheiro de leitura Readify." },

    /* ── Microsoft Desktop voices (Chrome + Edge on Windows) ── */
    { match: /microsoft.*zira.*desktop/i,                           displayName: "Zira",          tone: "Clear & Calm",         accent: "American" },
    { match: /microsoft.*david.*desktop/i,                          displayName: "David",         tone: "Steady & Professional",accent: "American" },
    { match: /microsoft.*mark/i,                                    displayName: "Mark",          tone: "Balanced & Neutral",   accent: "American" },
    { match: /microsoft.*hazel/i,                                   displayName: "Hazel",         tone: "Warm & Poised",        accent: "British" },

    /* ── Microsoft Online Natural voices (Edge only) ── */
    { match: /microsoft.*aria.*online.*natural/i,                   displayName: "Aria",          tone: "Warm & Friendly",      accent: "American" },
    { match: /microsoft.*jenny(?!.*multi).*online.*natural/i,       displayName: "Jenny",         tone: "Clear & Professional", accent: "American" },
    { match: /microsoft.*jenny.*multilingual.*online.*natural/i,    displayName: "Jenny Multi",   tone: "Versatile",            accent: "American" },
    { match: /microsoft.*guy.*online.*natural/i,                    displayName: "Guy",           tone: "Deep & Confident",     accent: "American" },
    { match: /microsoft.*ana(?!nya).*online.*natural.*united states/i, displayName: "Ana",        tone: "Soft & Gentle",        accent: "American" },
    { match: /microsoft.*sara.*online.*natural/i,                   displayName: "Sara",          tone: "Bright & Cheerful",    accent: "American" },
    { match: /microsoft.*sonia.*online.*natural/i,                  displayName: "Sonia",         tone: "Refined & British",    accent: "British" },
    { match: /microsoft.*ryan(?!.*multi).*online.*natural/i,        displayName: "Ryan",          tone: "Calm & Articulate",    accent: "British" },
    { match: /microsoft.*ryan.*multilingual.*online.*natural/i,     displayName: "Ryan Multi",    tone: "Versatile",            accent: "British" },
    { match: /microsoft.*libby.*online.*natural/i,                  displayName: "Libby",         tone: "Youthful & Lively",    accent: "British" },
    { match: /microsoft.*natasha.*online.*natural/i,                displayName: "Natasha",       tone: "Warm & Composed",      accent: "Australian" },
    { match: /microsoft.*william.*online.*natural/i,                displayName: "William",       tone: "Steady & Bold",        accent: "Australian" },
    { match: /microsoft.*neerja.*online.*natural/i,                 displayName: "Neerja",        tone: "Graceful & Melodic",   accent: "Indian" },
    { match: /microsoft.*prabhat.*online.*natural/i,                displayName: "Prabhat",       tone: "Rich & Authoritative", accent: "Indian" },
    { match: /microsoft.*nanami.*online.*natural/i,                 displayName: "Nanami",        tone: "Soft & Graceful",      accent: "Japanese", previewText: "こんにちは、Readifyの読書パートナーです。" },

    /* ── macOS built-in voices ── */
    { match: /\bsamantha\b/i,                                       displayName: "Samantha",      tone: "Friendly & Smooth",    accent: "American" },
    { match: /\bdaniel\b.*\ben/i,                                   displayName: "Daniel",        tone: "Deep & Resonant",      accent: "British" },
    { match: /\bkaren\b/i,                                          displayName: "Karen",         tone: "Warm & Natural",       accent: "Australian" },
  ];

  /* load speech-synthesis voices */
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) setVoices(v);
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    setReadCount(getReadCount(user?.email));
    // Fetch purchased count from backend
    if (user && localStorage.getItem("token")) {
      getPurchasedBooks()
        .then((books) => setPurchasedCount(books.length))
        .catch(() => setPurchasedCount(getPurchasedCount()));
    } else {
      setPurchasedCount(getPurchasedCount());
    }
  }, [user?.email]);

  // Load notification preferences for current user.
  useEffect(() => {
    setNotifReady(false);
    try {
      const raw = localStorage.getItem(notifStorageKey);
      if (!raw) {
        setNotifEmail(NOTIF_DEFAULTS.email);
        setNotifPromos(NOTIF_DEFAULTS.promos);
        setNotifNewBook(NOTIF_DEFAULTS.newBook);
        setNotifReady(true);
        return;
      }

      const parsed = JSON.parse(raw);
      setNotifEmail(Boolean(parsed?.email ?? NOTIF_DEFAULTS.email));
      setNotifPromos(Boolean(parsed?.promos ?? NOTIF_DEFAULTS.promos));
      setNotifNewBook(Boolean(parsed?.newBook ?? NOTIF_DEFAULTS.newBook));
      setNotifReady(true);
    } catch {
      setNotifEmail(NOTIF_DEFAULTS.email);
      setNotifPromos(NOTIF_DEFAULTS.promos);
      setNotifNewBook(NOTIF_DEFAULTS.newBook);
      setNotifReady(true);
    }
  }, [notifStorageKey]);

  // Persist and broadcast notification preferences in real time.
  useEffect(() => {
    if (!notifReady) return;
    const payload = {
      email: Boolean(notifEmail),
      promos: Boolean(notifPromos),
      newBook: Boolean(notifNewBook),
      updatedAt: Date.now(),
    };

    localStorage.setItem(notifStorageKey, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent("readify-notifications-changed", { detail: payload }));
  }, [notifEmail, notifNewBook, notifPromos, notifReady, notifStorageKey]);

  // Keep settings synced if another tab updates them.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== notifStorageKey || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        setNotifEmail(Boolean(parsed?.email));
        setNotifPromos(Boolean(parsed?.promos));
        setNotifNewBook(Boolean(parsed?.newBook));
      } catch {}
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [notifStorageKey]);

  const toggleNotification = (key) => {
    if (key === "email") setNotifEmail((value) => !value);
    if (key === "promos") setNotifPromos((value) => !value);
    if (key === "newBook") setNotifNewBook((value) => !value);
  };

  const handleLogout = () => { logout(); navigate("/app"); };

  const resetSecurityFlow = () => {
    setSecurityStep("human");
    setHumanChecked(false);
    setHumanA(Math.floor(Math.random() * 8) + 2);
    setHumanB(Math.floor(Math.random() * 8) + 2);
    setHumanAnswer("");
    setOtpCode("");
    setNewPwd("");
    setConfirmPwd("");
    setOldPwd("");
    setShowNewPwd(false);
    setShowConfirmPwd(false);
    setMsg("");
  };

  const handleSendOtp = async () => {
    const expected = humanA + humanB;
    const answerNumber = Number(humanAnswer);

    if (!humanChecked) {
      setMsg("Please confirm you are human.");
      return;
    }
    if (!Number.isFinite(answerNumber) || answerNumber !== expected) {
      setMsg("Human verification answer is incorrect.");
      return;
    }

    try {
      setSendingOtp(true);
      setMsg("");
      await sendPasswordChangeOtp();
      setSecurityStep("otp");
      setMsg("OTP sent to your registered email.");
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to send OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      setMsg("Please enter the OTP.");
      return;
    }

    try {
      setVerifyingOtp(true);
      setMsg("");
      await verifyPasswordChangeOtp(otpCode.trim());
      setSecurityStep("password");
      setMsg("OTP verified. You can now set a new password.");
    } catch (err) {
      setMsg(err?.response?.data?.message || "OTP verification failed.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    if (!newPwd || newPwd !== confirmPwd) {
      setMsg("New passwords do not match.");
      return;
    }
    if (newPwd.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

    try {
      setUpdatingPassword(true);
      setMsg("");
      await updatePasswordWithOtp(newPwd);
      setMsg("Password updated successfully in database.");
      resetSecurityFlow();
    } catch (err) {
      setMsg(err?.response?.data?.message || "Failed to update password.");
    } finally {
      setUpdatingPassword(false);
    }
  };

  /* ── auto-hide pic message after 3.5s ── */
  useEffect(() => {
    if (!picMsg) return;
    const t = setTimeout(() => setPicMsg(""), 3500);
    return () => clearTimeout(t);
  }, [picMsg]);

  useEffect(() => {
    if (!redeemMsg) return;
    const t = setTimeout(() => setRedeemMsg(""), 3200);
    return () => clearTimeout(t);
  }, [redeemMsg]);

  useEffect(() => {
    if (activeSection !== "xp") return;
    setLoadingRedeemBooks(true);
    fetchBooks()
      .then((response) => {
        const books = Array.isArray(response?.books)
          ? response.books
          : Array.isArray(response)
            ? response
            : [];
        setRedeemBooks(books);
      })
      .catch(() => setRedeemBooks([]))
      .finally(() => setLoadingRedeemBooks(false));
  }, [activeSection]);

  useEffect(() => {
    const timer = setInterval(() => setRewardClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    supportEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [supportMessages, supportConnecting]);

  useEffect(() => {
    if (!supportRecording) {
      setSupportRecordElapsed(0);
      return;
    }

    const timer = setInterval(() => {
      setSupportRecordElapsed(Math.max(0, Math.round((Date.now() - supportRecordStartRef.current) / 1000)));
    }, 250);

    return () => clearInterval(timer);
  }, [supportRecording]);

  useEffect(() => {
    return () => {
      if (supportRecorderRef.current && supportRecorderRef.current.state !== "inactive") {
        supportRecorderRef.current.stop();
      }
      if (supportRecordStreamRef.current) {
        supportRecordStreamRef.current.getTracks().forEach((track) => track.stop());
        supportRecordStreamRef.current = null;
      }
      if (supportSocketRef.current) {
        supportSocketRef.current.disconnect();
        supportSocketRef.current = null;
      }
    };
  }, []);

  /* ── profile picture handlers ── */
  const handlePicUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setPicMsg("Image must be under 5 MB.");
      return;
    }
    setUploadingPic(true);
    setPicMsg("");
    try {
      const data = await uploadProfilePic(file);
      updateProfilePic(data.profilePic);
      setPicMsg("✓ Profile picture updated!");
    } catch {
      setPicMsg("Failed to upload picture.");
    } finally {
      setUploadingPic(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePicRemove = async () => {
    setUploadingPic(true);
    setPicMsg("");
    try {
      await removeProfilePic();
      updateProfilePic(null);
      setPicMsg("✓ Profile picture removed.");
    } catch {
      setPicMsg("Failed to remove picture.");
    } finally {
      setUploadingPic(false);
    }
  };

  const currentDayKey = useMemo(() => toDayKey(new Date(rewardClock)), [rewardClock]);
  const nextResetCountdown = useMemo(() => getResetCountdownText(rewardClock), [rewardClock]);
  const dailyTaskSet = useMemo(() => getDailyTaskSet(currentDayKey), [currentDayKey]);
  const taskMetrics = useMemo(() => getTaskMetrics(user?.email, currentDayKey), [currentDayKey, rewardClock, user?.email]);

  const getTaskRequiredSeconds = (taskId) => {
    if (taskId === "read-20") return 20 * 60;
    if (taskId === "read-35") return 35 * 60;
    return 0;
  };

  const isTaskCompleted = (taskId) => {
    const requiredSeconds = getTaskRequiredSeconds(taskId);
    if (requiredSeconds > 0) return taskMetrics.readSeconds >= requiredSeconds;
    return true;
  };

  const xpPriceMap = useMemo(() => {
    const map = {};
    for (const book of redeemBooks) {
      if (!book?._id) continue;
      map[book._id] = getDailyRandomXpPrice(book._id, currentDayKey);
    }
    return map;
  }, [currentDayKey, redeemBooks]);

  const topRedeemBooks = useMemo(() => {
    return [...redeemBooks]
      .filter((book) => Boolean(book?._id))
      .sort((first, second) => (xpPriceMap[first._id] || 0) - (xpPriceMap[second._id] || 0))
      .slice(0, 12);
  }, [redeemBooks, xpPriceMap]);

  const appendSupportMessage = (message) => {
    const normalized = {
      id: message.id || `support-msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderType: message.senderType || "bot",
      senderName: message.senderName || "Readify Support",
      messageType: message.messageType === "audio" ? "audio" : "text",
      text: String(message.text || "").trim(),
      audioUrl: String(message.audioUrl || "").trim(),
      durationSec: Number(message.durationSec || 0) || 0,
      createdAt: message.createdAt || new Date().toISOString(),
    };
    if (normalized.messageType === "audio") {
      if (!normalized.audioUrl) return;
    } else if (!normalized.text) {
      return;
    }
    setSupportMessages((prev) => [...prev, normalized]);
  };

  const resetSupportConversationUi = ({ closeChat = true } = {}) => {
    setSupportMode("ai");
    setSupportConversationId("");
    setSupportAgentName("");
    setSupportConnecting(false);
    setSupportRecording(false);
    setSupportInput("");
    setSupportMicError("");
    setSupportMessages([createSupportWelcomeMessage()]);
    if (closeChat) {
      setSupportChatOpen(false);
    }
  };

  const ensureSupportSocket = (conversationId) => {
    if (supportSocketRef.current) return supportSocketRef.current;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      socket.emit("support:user:join", {
        conversationId,
        userName: user?.name || "Readify User",
        userEmail: user?.email || "guest@readify.app",
      });
    });

    socket.on("support:session", (session) => {
      if (!session || session.conversationId !== conversationId || !Array.isArray(session.messages)) return;
      setSupportMessages((prev) => {
        const existingIds = new Set(prev.map((item) => item.id));
        const incoming = session.messages.filter((item) => !existingIds.has(item.id));
        return incoming.length ? [...prev, ...incoming] : prev;
      });
      if (session.assignedAdmin) {
        setSupportAgentName(session.assignedAdmin);
        setSupportMode("live");
        setSupportConnecting(false);
      }
    });

    socket.on("support:agent-joined", (payload) => {
      if (!payload || payload.conversationId !== conversationId) return;
      setSupportAgentName(payload.adminName || "Support Agent");
      setSupportMode("live");
      setSupportConnecting(false);
      appendSupportMessage({
        senderType: "system",
        senderName: "System",
        text: `${payload.adminName || "Support Agent"} joined. You are now connected to live support.`,
      });
    });

    socket.on("support:message", (payload) => {
      if (!payload || payload.senderType === "user") return;
      appendSupportMessage(payload);
    });

    socket.on("support:conversation:deleted", (payload) => {
      if (!payload || payload.conversationId !== conversationId) return;
      resetSupportConversationUi({ closeChat: true });
    });

    socket.on("support:conversation:ended", (payload) => {
      if (!payload || payload.conversationId !== conversationId) return;
      resetSupportConversationUi({ closeChat: true });
    });

    supportSocketRef.current = socket;
    return socket;
  };

  const requestLiveAgent = (reasonText) => {
    const conversationId = supportConversationId || `support-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (!supportConversationId) setSupportConversationId(conversationId);

    setSupportMode("connecting");
    setSupportConnecting(true);
    appendSupportMessage({
      senderType: "bot",
      senderName: "Readify AI Support",
      text: "Please wait, I am connecting you to a customer support agent.",
    });

    const socket = ensureSupportSocket(conversationId);
    socket.emit("support:request", {
      conversationId,
      userName: user?.name || "Readify User",
      userEmail: user?.email || "guest@readify.app",
      reason: reasonText || "User requested customer support",
      emergency: true,
    });
  };

  const handleSupportSend = () => {
    const text = supportInput.trim();
    if (!text) return;

    appendSupportMessage({
      senderType: "user",
      senderName: user?.name || "You",
      text,
    });
    setSupportInput("");

    const wantsAgent = /customer support|live agent|talk with|human|not satisfied|speak to agent|emergency/i.test(text);
    if (supportMode === "live") {
      const socket = ensureSupportSocket(supportConversationId);
      socket.emit("support:message", {
        conversationId: supportConversationId,
        senderType: "user",
        senderName: user?.name || "Readify User",
        text,
      });
      return;
    }

    if (wantsAgent) {
      requestLiveAgent(text);
      return;
    }

    setSupportConnecting(true);
    window.setTimeout(() => {
      appendSupportMessage({
        senderType: "bot",
        senderName: "Readify AI Support",
        text: getSupportBotReply(text),
      });
      setSupportConnecting(false);
    }, 500);
  };

  const endSupportConversation = () => {
    if (!supportConversationId) {
      resetSupportConversationUi({ closeChat: true });
      return;
    }

    const socket = ensureSupportSocket(supportConversationId);
    socket.emit("support:user:endConversation", {
      conversationId: supportConversationId,
      endedBy: user?.name || "Readify User",
    });
    resetSupportConversationUi({ closeChat: true });
  };

  const sendSupportAudio = ({ audioUrl, durationSec }) => {
    if (!audioUrl) return;
    if (supportMode !== "live" || !supportConversationId) {
      appendSupportMessage({
        senderType: "bot",
        senderName: "Readify AI Support",
        text: "Voice chat is available once a live support agent is connected.",
      });
      return;
    }

    appendSupportMessage({
      senderType: "user",
      senderName: user?.name || "You",
      messageType: "audio",
      audioUrl,
      durationSec,
    });

    const socket = ensureSupportSocket(supportConversationId);
    socket.emit("support:message", {
      conversationId: supportConversationId,
      senderType: "user",
      senderName: user?.name || "Readify User",
      messageType: "audio",
      audioUrl,
      durationSec,
    });
  };

  const startSupportRecording = async () => {
    setSupportMicError("");
    if (supportMode !== "live" || !supportConversationId) {
      appendSupportMessage({
        senderType: "bot",
        senderName: "Readify AI Support",
        text: "Connect to a live support agent first, then you can send voice notes.",
      });
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setSupportMicError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      supportRecordChunksRef.current = [];
      supportRecordStartRef.current = Date.now();
      supportRecordStreamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          supportRecordChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const chunks = supportRecordChunksRef.current;
        supportRecordChunksRef.current = [];
        setSupportRecording(false);

        if (supportRecordStreamRef.current) {
          supportRecordStreamRef.current.getTracks().forEach((track) => track.stop());
          supportRecordStreamRef.current = null;
        }

        if (!chunks.length) return;

        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = typeof reader.result === "string" ? reader.result : "";
          const durationSec = Math.max(1, Math.round((Date.now() - supportRecordStartRef.current) / 1000));
          sendSupportAudio({ audioUrl: result, durationSec });
        };
        reader.readAsDataURL(blob);
      };

      supportRecorderRef.current = recorder;
      recorder.start();
      setSupportRecordElapsed(0);
      setSupportRecording(true);
    } catch {
      setSupportMicError("Microphone permission denied. Please allow mic access.");
    }
  };

  const stopSupportRecording = () => {
    if (supportRecorderRef.current && supportRecorderRef.current.state !== "inactive") {
      supportRecorderRef.current.stop();
    }
  };

  const toggleSupportRecording = () => {
    if (supportRecording) {
      stopSupportRecording();
      return;
    }
    startSupportRecording();
  };

  const handleClaimTask = (task) => {
    if (!isTaskCompleted(task.id)) {
      const required = getTaskRequiredSeconds(task.id);
      const remainingMinutes = Math.ceil(Math.max(0, required - taskMetrics.readSeconds) / 60);
      setRedeemMsg(`Read ${remainingMinutes} more minute${remainingMinutes === 1 ? "" : "s"} to claim this task.`);
      return;
    }

    const result = claimDailyTask(task.id, task.reward);
    setRedeemMsg(result.message);
  };

  const handleRedeemBook = (book) => {
    const price = xpPriceMap[book._id] || getDailyRandomXpPrice(book._id, currentDayKey);
    const result = redeemBookWithXp(book, price);
    setRedeemMsg(result.message);
    if (result.ok) {
      setPurchasedCount((previous) => Number(previous || 0) + 1);
    }
  };

  /* ── voice helpers ── */
  const QUALITY_TAGS = [
    { test: /online|natural|neural/i, label: "HD", cls: "hd" },
    { test: /google/i,                label: "Google", cls: "google" },
    { test: /microsoft/i,             label: "Microsoft", cls: "ms" },
  ];
  const voiceQuality = (v) => {
    for (const t of QUALITY_TAGS) if (t.test.test(v.name)) return t;
    return null;
  };

  /* build curated voice list: only match CURATED_VOICES that exist in browser */
  const curatedVoiceList = (() => {
    const result = [];
    const used = new Set();
    for (const cv of CURATED_VOICES) {
      const match = voices.find(v => cv.match.test(v.name) && !used.has(v.name));
      if (match) {
        used.add(match.name);
        result.push({
          voice: match,
          displayName: cv.displayName,
          tone: cv.tone,
          accent: cv.accent,
          previewText: cv.previewText || null,
        });
      }
    }
    return result;
  })();

  const filteredVoices = voiceFilter
    ? curatedVoiceList.filter(cv =>
        cv.displayName.toLowerCase().includes(voiceFilter.toLowerCase()) ||
        cv.tone.toLowerCase().includes(voiceFilter.toLowerCase()) ||
        cv.accent.toLowerCase().includes(voiceFilter.toLowerCase()) ||
        cv.voice.name.toLowerCase().includes(voiceFilter.toLowerCase()))
    : curatedVoiceList;


  const stopPreview = () => {
    previewSessionRef.current += 1;              // invalidate any pending callbacks
    clearTimeout(safetyTimerRef.current);
    window.speechSynthesis.cancel();
    setPreviewingIdx(-1);
    /* resume recognition after stopping preview */
    if (voiceResume) setTimeout(voiceResume, 200);
  };

  const previewVoice = (voice, idx) => {
    /* 1. cancel anything currently playing & bump session */
    previewSessionRef.current += 1;
    const session = previewSessionRef.current;
    clearTimeout(safetyTimerRef.current);
    window.speechSynthesis.cancel();

    /*
     * 2. Build utterance and speak SYNCHRONOUSLY (no setTimeout!)
     *    Chrome requires speechSynthesis.speak() within the user-gesture call stack.
     *    Wrapping in setTimeout breaks the gesture chain and silently fails.
     */
    const curated = curatedVoiceList.find(cv => cv.voice === voice);
    const text = (curated && curated.previewText)
      ? curated.previewText
      : "Hi, I'm your Readify reading companion. I can read books aloud for you with this voice.";
    const u = new SpeechSynthesisUtterance(text);
    u.voice  = voice;
    u.lang   = voice.lang;
    u.rate   = 1.0;
    u.pitch  = 1.0;
    u.volume = 0.9;

    u.onstart = () => {
      if (session !== previewSessionRef.current) return;
      clearTimeout(safetyTimerRef.current);
      setPreviewingIdx(idx);
    };

    u.onend = () => {
      if (session !== previewSessionRef.current) return;
      setPreviewingIdx(-1);
      /* resume recognition after voice finishes */
      if (voiceResume) setTimeout(voiceResume, 200);
    };
    u.onerror = () => {
      if (session !== previewSessionRef.current) return;
      setPreviewingIdx(-1);
    };

    /* pause background recognition to avoid audio resource contention */
    if (voicePause) voicePause();

    /* show "playing" state immediately so user gets visual feedback */
    setPreviewingIdx(idx);
    window.speechSynthesis.speak(u);

    /*
     * Chrome workaround: speechSynthesis can get stuck in a "paused" state
     * after cancel(). Calling resume() forces it to actually start speaking.
     */
    window.speechSynthesis.resume();

    /* Chrome 15-second bug workaround: periodically call resume() */
    const resumeInterval = setInterval(() => {
      if (session !== previewSessionRef.current) {
        clearInterval(resumeInterval);
        return;
      }
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.resume();
      } else {
        clearInterval(resumeInterval);
      }
    }, 5000);

    /* safety: if onstart never fires within 4s, reset */
    safetyTimerRef.current = setTimeout(() => {
      if (session === previewSessionRef.current && !window.speechSynthesis.speaking) {
        clearInterval(resumeInterval);
        window.speechSynthesis.cancel();
        setPreviewingIdx(-1);
      }
    }, 4000);
  };

  const selectVoice = (voice) => {
    localStorage.setItem("readify_voice", voice.name);
    setSelectedVoice(voice.name);
    /* dispatch event so VoiceContext picks it up live */
    window.dispatchEvent(new CustomEvent("readify-voice-changed", { detail: voice.name }));
  };

  /* ── not signed in ── */
  if (!user) {
    return (
      <div className="acc-page acc-empty">
        <div className="acc-empty-box">
          <div className="acc-empty-icon">🔒</div>
          <h2>You&apos;re not signed in</h2>
          <p>Please sign in to view your account settings.</p>
          <button className="acc-btn-primary" onClick={() => navigate("/login")}>Sign In</button>
        </div>
      </div>
    );
  }

  /* ── right-panel content ── */
  const renderPanel = () => {
    /* ── security / change password ── */
    if (activeSection === "security") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => { setActiveSection(null); setMsg(""); resetSecurityFlow(); }}>← Back</button>
        <h3>Password &amp; Security</h3>
        <p className="acc-panel-sub">Secure reset flow: Human verification, OTP verification, then password update.</p>

        <div className="acc-security-steps">
          <div className={`acc-security-step${securityStep === "human" ? " active" : ""}`}>1. Human Check</div>
          <div className={`acc-security-step${securityStep === "otp" ? " active" : ""}`}>2. OTP Verify</div>
          <div className={`acc-security-step${securityStep === "password" ? " active" : ""}`}>3. New Password</div>
        </div>

        {securityStep === "human" && (
          <div className="acc-security-card">
            <label className="acc-human-check-row">
              <input
                type="checkbox"
                checked={humanChecked}
                onChange={(e) => setHumanChecked(e.target.checked)}
              />
              <span>I confirm I am a human user</span>
            </label>

            <label>
              Solve this to continue ({humanA} + {humanB})
              <input
                type="number"
                value={humanAnswer}
                placeholder="Enter answer"
                onChange={(e) => setHumanAnswer(e.target.value)}
              />
            </label>

            <div className="acc-form-actions">
              <button className="acc-btn-primary" type="button" onClick={handleSendOtp} disabled={sendingOtp}>
                {sendingOtp ? "Sending OTP..." : "Verify Human & Send OTP"}
              </button>
              <button
                className="acc-btn-ghost"
                type="button"
                onClick={() => {
                  setHumanA(Math.floor(Math.random() * 8) + 2);
                  setHumanB(Math.floor(Math.random() * 8) + 2);
                  setHumanAnswer("");
                }}
              >
                New Challenge
              </button>
            </div>
          </div>
        )}

        {securityStep === "otp" && (
          <div className="acc-security-card">
            <label>
              Enter OTP sent to {user.email}
              <input
                type="text"
                value={otpCode}
                placeholder="6-digit OTP"
                onChange={(e) => setOtpCode(e.target.value)}
                maxLength={6}
              />
            </label>

            <div className="acc-form-actions">
              <button className="acc-btn-primary" type="button" onClick={handleVerifyOtp} disabled={verifyingOtp}>
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
              <button className="acc-btn-ghost" type="button" onClick={handleSendOtp} disabled={sendingOtp}>
                {sendingOtp ? "Sending..." : "Resend OTP"}
              </button>
            </div>
          </div>
        )}

        {securityStep === "password" && (
          <form className="acc-pwd-form" onSubmit={handleUpdatePassword}>
            <label>New password
              <div className="acc-pass-wrap">
                <input
                  type={showNewPwd ? "text" : "password"}
                  value={newPwd}
                  placeholder="Min. 6 characters"
                  onChange={e => setNewPwd(e.target.value)}
                />
                <button
                  type="button"
                  className="acc-pass-toggle"
                  onClick={() => setShowNewPwd((v) => !v)}
                  aria-label={showNewPwd ? "Hide password" : "Show password"}
                  title={showNewPwd ? "Hide password" : "Show password"}
                >
                  <i className={`fas ${showNewPwd ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </label>
            <label>Confirm new password
              <div className="acc-pass-wrap">
                <input
                  type={showConfirmPwd ? "text" : "password"}
                  value={confirmPwd}
                  placeholder="Repeat new password"
                  onChange={e => setConfirmPwd(e.target.value)}
                />
                <button
                  type="button"
                  className="acc-pass-toggle"
                  onClick={() => setShowConfirmPwd((v) => !v)}
                  aria-label={showConfirmPwd ? "Hide password" : "Show password"}
                  title={showConfirmPwd ? "Hide password" : "Show password"}
                >
                  <i className={`fas ${showConfirmPwd ? "fa-eye-slash" : "fa-eye"}`} />
                </button>
              </div>
            </label>
            <div className="acc-form-actions">
              <button className="acc-btn-primary" type="submit" disabled={updatingPassword}>
                {updatingPassword ? "Updating..." : "Update Password"}
              </button>
              <button className="acc-btn-ghost" type="button" onClick={resetSecurityFlow}>Start Over</button>
            </div>
          </form>
        )}

        <div className="acc-form-actions" style={{ marginTop: 14 }}>
          <button className="acc-btn-ghost" type="button" onClick={() => { setActiveSection(null); setMsg(""); resetSecurityFlow(); }}>Close</button>
          <button className="acc-btn-ghost" type="button" onClick={resetSecurityFlow}>Reset Flow</button>
        </div>

        {msg && <div className={`acc-form-msg ${msg.toLowerCase().includes("success") || msg.startsWith("OTP") ? "success" : "error"}`}>{msg}</div>}
      </div>
    );

    /* ── voice settings ── */
    if (activeSection === "voice") return (
      <div className="acc-panel-section acc-voice-panel">
        <button className="acc-back-btn" onClick={() => { setActiveSection(null); window.speechSynthesis.cancel(); setPreviewingIdx(-1); }}>← Back</button>
        <h3><Icon d={ICONS.speaker} size={22} /> Voice Settings</h3>
        <p className="acc-panel-sub">Choose a voice for Readify&apos;s assistant. Tap the play button to preview.</p>

        {/* current voice indicator */}
        <div className="acc-voice-current">
          <span className="acc-voice-current-label">Active voice</span>
          <span className="acc-voice-current-name">{selectedVoice || "System default"}</span>
        </div>

        {/* search */}
        <div className="acc-voice-controls">
          <div className="acc-voice-search-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="acc-voice-search"
              type="text"
              placeholder="Search by name, accent, or tone…"
              value={voiceFilter}
              onChange={e => setVoiceFilter(e.target.value)}
            />
          </div>
        </div>

        {/* voice count */}
        <div className="acc-voice-count">{filteredVoices.length} voice{filteredVoices.length !== 1 ? "s" : ""} available</div>

        {/* voice list */}
        <div className="acc-voice-list">
          {filteredVoices.length === 0 && (
            <div className="acc-voice-empty">No voices match your search.</div>
          )}
          {filteredVoices.map((cv, i) => {
            const v = cv.voice;
            const isActive = v.name === selectedVoice;
            const isPreviewing = previewingIdx === i;
            const quality = voiceQuality(v);
            return (
              <div
                key={v.name + v.lang}
                className={`acc-voice-card${isActive ? " active" : ""}${isPreviewing ? " previewing" : ""}`}
              >
                {/* wave bars animation (visible during preview) */}
                <div className="acc-voice-wave">
                  <span/><span/><span/><span/><span/>
                </div>

                <div className="acc-voice-info">
                  <div className="acc-voice-name">
                    {cv.displayName}
                    {quality && <span className={`acc-voice-badge ${quality.cls}`}>{quality.label}</span>}
                  </div>
                  <div className="acc-voice-meta">
                    <span className="acc-voice-tone">{cv.tone}</span>
                    <span className="acc-voice-accent">{cv.accent}</span>
                  </div>
                </div>

                <div className="acc-voice-actions">
                  <button
                    className={`acc-voice-preview-btn${isPreviewing ? " playing" : ""}`}
                    title={isPreviewing ? "Stop" : "Preview"}
                    onClick={() => {
                      if (isPreviewing) {
                        stopPreview();
                      } else {
                        previewVoice(v, i);
                      }
                    }}
                  >
                    {isPreviewing ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                  <button
                    className={`acc-voice-select-btn${isActive ? " selected" : ""}`}
                    onClick={() => selectVoice(v)}
                  >
                    {isActive ? "✓ Active" : "Use"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );

    /* ── notifications ── */
    if (activeSection === "notif") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => setActiveSection(null)}>← Back</button>
        <h3>Notifications</h3>
        <p className="acc-panel-sub">Choose what updates you receive from Readify.</p>
        <div className="acc-toggle-list">
          {[
            { id: "email", label: "Email updates", desc: "Receive account activity by email", val: notifEmail },
            { id: "promos", label: "Promotional offers", desc: "Deals, discounts and book bundles", val: notifPromos },
            { id: "newBook", label: "New releases", desc: "Be first to know about new books", val: notifNewBook },
          ].map(({ id, label, desc, val }) => (
            <div key={label} className="acc-toggle-row">
              <div>
                <div className="acc-toggle-label">{label}</div>
                <div className="acc-toggle-desc">{desc}</div>
              </div>
              <button
                className={`acc-toggle ${val ? "on" : ""}`}
                onClick={() => toggleNotification(id)}
                aria-label={val ? `${label} enabled` : `${label} disabled`}
                aria-pressed={val}
              >
                <span className="acc-toggle-knob" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );

    /* ── xp wallet & redeem ── */
    if (activeSection === "xp") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => setActiveSection(null)}>← Back</button>
        <h3>XP Wallet &amp; Redeem</h3>
        <p className="acc-panel-sub">Microsoft Rewards-style daily refresh with real-time wallet updates and random XP pricing.</p>

        <div className="acc-xp-refresh-row">
          <span>Daily tasks refresh in</span>
          <strong>{nextResetCountdown}</strong>
        </div>

        <div className="acc-xp-overview">
          <div className="acc-xp-card wallet">
            <div className="acc-xp-card-label">Wallet Balance</div>
            <div className="acc-xp-card-value">{Number(walletXp || 0).toLocaleString()} XP</div>
          </div>
          <div className="acc-xp-card total">
            <div className="acc-xp-card-label">Lifetime XP</div>
            <div className="acc-xp-card-value">{Number(totalXp || 0).toLocaleString()} XP</div>
          </div>
          <div className="acc-xp-card level">
            <div className="acc-xp-card-label">Current Level</div>
            <div className="acc-xp-card-value">Level {level}</div>
          </div>
        </div>

        <div className="acc-xp-section-title">Daily Tasks (Auto-refresh every day)</div>
        <div className="acc-xp-task-list">
          {dailyTaskSet.map((task) => {
            const completed = isTaskCompleted(task.id);
            const canClaim = completed && canClaimDailyTask(task.id);
            const isAlreadyClaimed = !canClaimDailyTask(task.id);
            const requiredSeconds = getTaskRequiredSeconds(task.id);
            const remainingMinutes = requiredSeconds > 0
              ? Math.ceil(Math.max(0, requiredSeconds - taskMetrics.readSeconds) / 60)
              : 0;
            return (
              <div key={task.id} className="acc-xp-task-row">
                <div>
                  <div className="acc-xp-task-title">{task.title}</div>
                  <div className="acc-xp-task-reward">
                    Reward: +{task.reward} XP
                    {requiredSeconds > 0 && !completed ? ` • ${remainingMinutes}m remaining` : ""}
                  </div>
                </div>
                <button
                  className={`acc-xp-task-btn${canClaim ? "" : " done"}`}
                  disabled={!canClaim}
                  onClick={() => handleClaimTask(task)}
                >
                  {canClaim ? "Claim XP" : (isAlreadyClaimed ? "Completed Today" : "In Progress")}
                </button>
              </div>
            );
          })}
        </div>

        <div className="acc-xp-section-title">Redeem Books (Random Price: 5000 - 100000 XP)</div>
        {loadingRedeemBooks ? (
          <div className="acc-xp-loading">Loading redeemable books...</div>
        ) : (
          <div className="acc-xp-book-grid">
            {topRedeemBooks.map((book) => {
              const price = xpPriceMap[book._id] || getDailyRandomXpPrice(book._id, currentDayKey);
              const canBuy = Number(walletXp || 0) >= price;
              return (
                <div key={book._id} className="acc-xp-book-card">
                  <img src={book.coverUrl || book.cover || "/placeholder-book.png"} alt={book.title || "Book"} className="acc-xp-book-cover" />
                  <div className="acc-xp-book-meta">
                    <div className="acc-xp-book-title">{book.title || "Untitled"}</div>
                    <div className="acc-xp-book-author">{book.author || "Unknown Author"}</div>
                    <div className="acc-xp-book-price">{price.toLocaleString()} XP</div>
                  </div>
                  <button
                    className={`acc-xp-redeem-btn${canBuy ? "" : " disabled"}`}
                    disabled={!canBuy}
                    onClick={() => handleRedeemBook(book)}
                  >
                    {canBuy ? "Redeem" : "Need More XP"}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {redeemMsg && <div className={`acc-form-msg ${redeemMsg.startsWith("+") || redeemMsg.includes("unlocked") ? "success" : "error"}`}>{redeemMsg}</div>}
      </div>
    );

    /* ── privacy ── */
    if (activeSection === "privacy") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => setActiveSection(null)}>← Back</button>
        <h3>Privacy Settings</h3>
        <p className="acc-panel-sub">Control how your data is used on Readify.</p>
        <div className="acc-info-block">
          <p>Your reading history and preferences are stored locally on this device and are never shared with third parties.</p>
          <p>You can clear all stored data at any time.</p>
          <button className="acc-btn-danger-outline" onClick={() => {
            const userEmail = localStorage.getItem("email");
            const key = userEmail ? `readBooks_${userEmail}` : "readBooks";
            localStorage.removeItem(key);
            localStorage.removeItem("rentedBooks");
            alert("Reading data cleared.");
          }}>Clear Reading History</button>
        </div>
      </div>
    );

    /* ── appearance ── */
    if (activeSection === "theme") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => setActiveSection(null)}>← Back</button>
        <h3>Appearance</h3>
        <p className="acc-panel-sub">Customise Readify's look and feel for comfortable reading.</p>
        <div className="acc-info-block">
          <div 
            className={`acc-theme-preview dark ${theme === 'dark' ? 'active' : ''}`}
            onClick={(e) => { if (theme !== 'dark') toggleTheme(e); }}
            style={{ cursor: 'pointer' }}
          >
            <span>Dark</span>
            {theme === 'dark' && <span className="acc-badge">Active</span>}
          </div>
          <div 
            className={`acc-theme-preview light ${theme === 'light' ? 'active' : ''}`}
            onClick={(e) => { if (theme !== 'light') toggleTheme(e); }}
            style={{ cursor: 'pointer', opacity: 1 }}
          >
            <span>Light</span>
            {theme === 'light' && <span className="acc-badge">Active</span>}
          </div>
        </div>
      </div>
    );

    /* ── about ── */
    if (activeSection === "about") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => setActiveSection(null)}>← Back</button>
        <h3>About Readify</h3>
        <div className="acc-about-grid">
          {[["Version", "1.0.0"], ["Stack", "MERN (React 19 + Node.js)"], ["Database", "MongoDB Atlas"], ["Licence", "MIT"]].map(([k, v]) => (
            <div key={k} className="acc-about-row"><span className="acc-about-key">{k}</span><span className="acc-about-val">{v}</span></div>
          ))}
        </div>
        <a className="acc-btn-primary acc-btn-block" href="/info/index.html">More to know</a>
      </div>
    );

    /* ── help ── */
    if (activeSection === "help") return (
      <div className="acc-panel-section">
        <button className="acc-back-btn" onClick={() => setActiveSection(null)}>← Back</button>
        <h3>Help &amp; Support</h3>
        <div className="acc-faq-list">
          {[
            ["How do I purchase a book?", "Browse the catalogue, open a book page and click 'Add to Cart'. Complete checkout to access your purchase."],
            ["Can I read on multiple devices?", "Yes — your account syncs across any device you sign in to."],
            ["How do I report an issue?", "Use the contact form below or email support@readify.app."],
          ].map(([q, a]) => (
            <details key={q} className="acc-faq-item">
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>

        {!supportChatOpen ? (
          <button className="acc-btn-primary acc-btn-block" onClick={() => setSupportChatOpen(true)}>Contact Support</button>
        ) : (
          <div className="acc-support-chat-wrap">
            <div className="acc-support-chat-header">
              <div>
                <div className="acc-support-title">AI Support Assistant</div>
                <div className="acc-support-subtitle">
                  {supportMode === "live"
                    ? `Connected to agent: ${supportAgentName || "Support Agent"}`
                    : supportMode === "connecting"
                      ? "Connecting to customer support..."
                      : "Ask multiple questions. Type if you need live support."}
                </div>
              </div>
              <div className="acc-support-header-actions">
                <button className="acc-btn-danger-outline" onClick={endSupportConversation}>End Conversation</button>
                <button className="acc-btn-ghost" onClick={() => setSupportChatOpen(false)}>Close</button>
              </div>
            </div>

            <div className="acc-support-quick-row">
              {[
                "Refund for my order",
                "My account is lost",
                "Account security issue",
                "I want to talk with customer support",
              ].map((item) => (
                <button key={item} className="acc-support-chip" onClick={() => setSupportInput(item)}>{item}</button>
              ))}
            </div>

            <div className="acc-support-messages">
              {supportMessages.map((message) => (
                <div key={message.id} className={`acc-support-msg acc-support-msg-${message.senderType}`}>
                  <div className="acc-support-msg-name">{message.senderName}</div>
                  {message.messageType === "audio" ? (
                    <div className="acc-support-audio-wrap">
                      <VoiceNotePlayer audioUrl={message.audioUrl} durationSec={message.durationSec} />
                      <div className="acc-support-audio-meta">Voice note {message.durationSec ? `• ${message.durationSec}s` : ""}</div>
                    </div>
                  ) : (
                    <div className="acc-support-msg-text">{message.text}</div>
                  )}
                </div>
              ))}
              {supportConnecting && <div className="acc-support-typing">Typing...</div>}
              <div ref={supportEndRef} />
            </div>

            <div className="acc-support-input-row">
              <button
                className={`acc-support-voice-btn ${supportRecording ? "recording" : ""}`}
                onClick={toggleSupportRecording}
                title={supportRecording ? "Stop recording" : "Record voice note"}
              >
                {supportRecording ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10v10H7z" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14a3 3 0 003-3V6a3 3 0 10-6 0v5a3 3 0 003 3zm5-3a1 1 0 112 0 7 7 0 01-6 6.93V20h2a1 1 0 110 2H9a1 1 0 110-2h2v-2.07A7 7 0 015 11a1 1 0 112 0 5 5 0 0010 0z" /></svg>
                )}
                <span>{supportRecording ? `Rec ${formatAudioTime(supportRecordElapsed)}` : "Voice"}</span>
              </button>
              <textarea
                className="acc-support-input"
                value={supportInput}
                onChange={(event) => setSupportInput(event.target.value)}
                placeholder="Ask about refund, order, account security, or lost account..."
                rows={2}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSupportSend();
                  }
                }}
              />
              <button className="acc-btn-primary" onClick={handleSupportSend}>Send</button>
            </div>
            {supportMicError && <div className="acc-support-mic-error">{supportMicError}</div>}
          </div>
        )}
      </div>
    );

    /* ── default overview ── */
    return (
      <>
        <div className="acc-section-heading">Quick Access</div>
        <div className="acc-tiles-grid">
          {QUICK_TILES.map(t => (
            <button
              key={t.id}
              className="acc-tile"
              style={{ "--tile-color": t.color }}
              onClick={() => navigate(t.route)}
            >
              <div className="acc-tile-icon"><Icon d={ICONS[t.icon]} size={24} /></div>
              <div className="acc-tile-body">
                <div className="acc-tile-label">{t.label}</div>
                <div className="acc-tile-desc">{t.desc}</div>
              </div>
              <Icon d={ICONS.chevron} size={16} />
            </button>
          ))}
        </div>

        <div className="acc-section-heading" style={{ marginTop: 28 }}>Settings</div>
        <div className="acc-settings-list">
          {SETTING_ROWS.map(row => (
            <button key={row.icon} className="acc-setting-row" onClick={() => setActiveSection(row.icon)}>
              <div className="acc-setting-icon"><Icon d={ICONS[row.icon]} size={20} /></div>
              <div className="acc-setting-body">
                <div className="acc-setting-label">{row.label}</div>
                <div className="acc-setting-desc">{row.desc}</div>
              </div>
              <Icon d={ICONS.chevron} size={16} />
            </button>
          ))}
        </div>

        <div className="acc-danger-zone">
          <button className="acc-btn-danger-outline" onClick={handleLogout}>
            <Icon d={ICONS.logout} size={18} /> Sign Out
          </button>
        </div>
      </>
    );
  };

  /* ── main render ── */
  return (
    <div className="acc-page">

      {/* ── hero profile banner ── */}
      <div className="acc-hero">
        <div className="acc-hero-bg" />
        <div className="acc-hero-content">
          <div className={`acc-avatar ${user.profilePic ? "has-pic" : ""}`}>
            {user.profilePic ? (
              <img src={`http://localhost:5000${user.profilePic}`} alt="Profile" className="acc-avatar-img" />
            ) : (
              <span>{getInitials(user.name)}</span>
            )}
            {/* camera edit overlay */}
            <button
              className="acc-avatar-edit"
              title={user.profilePic ? "Change profile picture" : "Add profile picture"}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPic}
            >
              {uploadingPic ? (
                <svg className="acc-avatar-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              )}
            </button>
            {/* remove button (only when pic exists) */}
            {user.profilePic && !uploadingPic && (
              <button className="acc-avatar-remove" title="Remove profile picture" onClick={handlePicRemove}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="acc-avatar-input"
              onChange={handlePicUpload}
            />
          </div>
          {picMsg && <div className={`acc-pic-msg ${picMsg.startsWith("✓") ? "success" : "error"}`}>{picMsg}</div>}
          <div className="acc-hero-info">
            <h1 className="acc-hero-name">{user.name || "Reader"}</h1>
            <p className="acc-hero-email">{user.email}</p>
            <span className="acc-hero-badge">📚 Readify Member</span>
          </div>
        </div>

        {/* stats bar */}
        <div className="acc-stats-bar">
          {[
            { num: readCount,      label: "Books Read",   icon: "📖" },
            { num: Number(walletXp || 0).toLocaleString(), label: "XP", iconClass: "fas fa-medal" },
            { num: purchasedCount, label: "Purchased",    icon: "🛒" },
          ].map(s => (
            <div key={s.label} className="acc-stat">
              <div className="acc-stat-icon">{s.iconClass ? <i className={s.iconClass} aria-hidden="true"></i> : (s.iconPath ? <Icon d={s.iconPath} size={20} /> : s.icon)}</div>
              <div className="acc-stat-num">{s.num}</div>
              <div className="acc-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── main content area ── */}
      <div className="acc-body">
        {renderPanel()}
      </div>

    </div>
  );
}
