import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { completeOnboarding, savePreferences } from "../services/authService";
import "../styles/onboarding.css";

/* ── Q&A Data ── */
const QUESTIONS = [
  {
    id: "genres",
    question: "What genres do you enjoy most?",
    subtitle: "Pick up to 3 that excite you!",
    multiSelect: true,
    maxSelect: 3,
    options: [
      { value: "Fantasy", icon: "🐉", label: "Fantasy" },
      { value: "Sci-Fi", icon: "🚀", label: "Sci-Fi" },
      { value: "Mystery", icon: "🔍", label: "Mystery" },
      { value: "Romance", icon: "💕", label: "Romance" },
      { value: "Non-Fiction", icon: "📰", label: "Non-Fiction" },
      { value: "History", icon: "🏛️", label: "History" },
      { value: "Self-Help", icon: "🌱", label: "Self-Help" },
      { value: "Technology", icon: "💻", label: "Technology" },
    ],
    compliments: {
      Fantasy: "A Fantasy lover! Prepare for epic adventures! 🐉",
      "Sci-Fi": "Sci-Fi fan! Ready to explore galaxies far away! 🚀",
      Mystery: "Mystery reader! Nothing escapes your sharp eye! 🔍",
      Romance: "A romantic soul! Beautiful stories await you! 💕",
      "Non-Fiction": "Love for facts! Knowledge is true power! 📰",
      History: "A history buff! The past holds amazing secrets! 🏛️",
      "Self-Help": "Growth mindset! You're unstoppable! 🌱",
      Technology: "Tech enthusiast! The future is in your hands! 💻",
      _default: "Excellent taste! We have so much for you! ✨",
    },
  },
  {
    id: "frequency",
    question: "How often do you read?",
    subtitle: "No judgment, just curiosity!",
    multiSelect: false,
    options: [
      { value: "Daily", icon: "📖", label: "Every day" },
      { value: "Few times a week", icon: "📅", label: "Few times a week" },
      { value: "Weekends", icon: "☀️", label: "Weekends only" },
      { value: "Once in a while", icon: "🌙", label: "Once in a while" },
    ],
    compliments: {
      Daily: "A daily reader! That's incredible discipline! 📖",
      "Few times a week": "Consistent reader! Great habit to have! 📅",
      Weekends: "Weekend bookworm! Perfect way to unwind! ☀️",
      "Once in a while": "Quality over quantity! Every page counts! 🌙",
    },
  },
  {
    id: "goal",
    question: "What's your reading goal?",
    subtitle: "What drives you to pick up a book?",
    multiSelect: false,
    options: [
      { value: "Learn new skills", icon: "🧠", label: "Learn new skills" },
      { value: "Entertainment", icon: "🎭", label: "Entertainment & escape" },
      { value: "Stay informed", icon: "🌍", label: "Stay informed" },
      { value: "Personal growth", icon: "🌟", label: "Personal growth" },
    ],
    compliments: {
      "Learn new skills": "Knowledge seeker! The world is your classroom! 🧠",
      Entertainment: "Escapist at heart! Get ready for wild rides! 🎭",
      "Stay informed": "Informed reader! Staying ahead of the curve! 🌍",
      "Personal growth": "Growth champion! Every book levels you up! 🌟",
    },
  },
  {
    id: "format",
    question: "How do you prefer to read?",
    subtitle: "We support all formats!",
    multiSelect: false,
    options: [
      { value: "Physical books", icon: "📕", label: "Physical books" },
      { value: "E-books", icon: "📱", label: "E-books" },
      { value: "Audiobooks", icon: "🎧", label: "Audiobooks" },
      { value: "Mix of all", icon: "🔄", label: "Mix of everything" },
    ],
    compliments: {
      "Physical books": "Nothing beats that new book smell! Classic choice! 📕",
      "E-books": "Digital reader! Your library fits in your pocket! 📱",
      Audiobooks: "Audiobook lover! Stories on the go, love it! 🎧",
      "Mix of all": "Best of all worlds! A true bibliophile! 🔄",
    },
  },
  {
    id: "excited",
    question: "What excites you most about Readify?",
    subtitle: "We built these features just for you!",
    multiSelect: false,
    options: [
      { value: "AI recommendations", icon: "🤖", label: "AI recommendations" },
      { value: "Huge library", icon: "📚", label: "Huge book library" },
      { value: "Playlists", icon: "🎵", label: "Reading playlists" },
      { value: "Community", icon: "👥", label: "Community features" },
    ],
    compliments: {
      "AI recommendations": "Our AI will blow your mind with picks! 🤖",
      "Huge library": "50K+ books waiting for you! Dive in! 📚",
      Playlists: "Organize your reads like a pro! Love it! 🎵",
      Community: "Join fellow readers! You're never alone here! 👥",
    },
  },
];

/* ── Typing effect hook ── */
function useTypingEffect(text, speed = 30, trigger = true) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!trigger) { setDisplayed(""); setDone(false); return; }
    setDisplayed("");
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed, trigger]);

  return { displayed, done };
}

/* ── Bot Speech (Text-to-Speech) — natural, low-latency ── */
const _cachedBotVoice = { current: null };

function pickNaturalVoice() {
  if (_cachedBotVoice.current) return _cachedBotVoice.current;
  const voices = window.speechSynthesis?.getVoices() || [];
  if (voices.length === 0) return null;

  // ① User-saved preference (Account → Voice Settings)
  const saved = localStorage.getItem("readify_voice");
  if (saved) {
    const match = voices.find(v => v.name === saved);
    if (match) { _cachedBotVoice.current = match; return match; }
  }

  // ② Priority cascade — best natural English voices first
  const priorities = [
    // Google high-quality (Chrome)
    v => /google.*female/i.test(v.name),
    v => /google.*uk.*female/i.test(v.name),
    // Microsoft Online (Natural) voices — these sound the best on Edge/Windows
    v => /microsoft.*online.*\(natural\)/i.test(v.name) && /en/i.test(v.lang),
    // Known natural female names
    v => /zira|samantha|karen|moira|fiona|victoria|susan|hazel|catherine|linda|emily|jenny|aria|sara|sonia/i.test(v.name),
    // Microsoft desktop female voices
    v => /microsoft.*(zira|hazel|susan|catherine|linda|emily|jenny|aria|sara|sonia)/i.test(v.name),
    // Any voice with "female" in name
    v => /female/i.test(v.name),
    // English voices that are typically female
    v => v.lang.startsWith("en") && !/male|david|mark|james|richard|george|daniel|ryan|guy|roger/i.test(v.name),
  ];

  for (const test of priorities) {
    const match = voices.find(v => v.lang.startsWith("en") && test(v));
    if (match) { _cachedBotVoice.current = match; return match; }
  }

  // Fallback: any English voice
  const eng = voices.find(v => v.lang.startsWith("en"));
  if (eng) _cachedBotVoice.current = eng;
  return eng || null;
}

function useBotSpeech(text, trigger = true, onSpeechEnd = null) {
  const utteranceRef = useRef(null);
  const endCallbackRef = useRef(onSpeechEnd);
  endCallbackRef.current = onSpeechEnd;

  useEffect(() => {
    // Cancel any previous speech immediately
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }

    if (!trigger || !text || typeof window === "undefined" || !window.speechSynthesis) return;

    // Strip emoji and special chars for cleaner speech
    const cleanText = text
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]/gu, "")
      .replace(/[✨✓🔄]/g, "")
      .trim();

    if (!cleanText) return;

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Natural, human-like voice tuning — slower & deeper = less robotic
      utterance.rate = 0.95;
      utterance.pitch = 1.04;
      utterance.volume = 0.85;

      const voice = pickNaturalVoice();
      if (voice) utterance.voice = voice;

      utterance.onend = () => {
        if (endCallbackRef.current) endCallbackRef.current();
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    };

    // Chrome loads voices async — wait if needed
    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      const onVoices = () => {
        _cachedBotVoice.current = null;
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        speak();
      };
      window.speechSynthesis.addEventListener("voiceschanged", onVoices);
      return () => {
        window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
        window.speechSynthesis.cancel();
        utteranceRef.current = null;
      };
    }

    speak();

    return () => {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    };
  }, [text, trigger]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);
}

/* ── Confetti component ── */
function Confetti() {
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
    color: ["#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#10b981", "#3b82f6"][i % 6],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="ob-confetti" aria-hidden>
      {pieces.map(p => (
        <div
          key={p.id}
          className="ob-confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size * 0.4}px`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

/* ── Particle background ── */
function useParticles(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w = window.innerWidth, h = window.innerHeight;
    canvas.width = w; canvas.height = h;

    const resize = () => { w = window.innerWidth; h = window.innerHeight; canvas.width = w; canvas.height = h; };
    window.addEventListener("resize", resize);

    let mouse = { x: w / 2, y: h / 2 };
    const onMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    window.addEventListener("mousemove", onMove);

    const COUNT = 45, MAX_DIST = 120, MAX_DIST_SQ = MAX_DIST * MAX_DIST, MOUSE_DIST = 150, MOUSE_DIST_SQ = MOUSE_DIST * MOUSE_DIST;
    const particles = Array.from({ length: COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 2 + 0.6,
      gold: Math.random() > 0.7,
    }));

    let animId;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 0.5;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x, dy = particles[i].y - particles[j].y;
          const dSq = dx * dx + dy * dy;
          if (dSq < MAX_DIST_SQ) {
            const d = Math.sqrt(dSq);
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(139,92,246,${(1 - d / MAX_DIST) * 0.2})`;
            ctx.stroke();
          }
        }
      }
      for (const p of particles) {
        const dx = p.x - mouse.x, dy = p.y - mouse.y, dSq = dx * dx + dy * dy;
        if (dSq < MOUSE_DIST_SQ) {
          const d = Math.sqrt(dSq);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = `rgba(245,158,11,${(1 - d / MOUSE_DIST) * 0.4})`;
          ctx.lineWidth = 0.8; ctx.stroke();
          ctx.lineWidth = 0.5;
          p.vx += (dx / d) * 0.02; p.vy += (dy / d) * 0.02;
        }
      }
      for (const p of particles) {
        p.vx *= 0.99; p.vy *= 0.99;
        const sp = Math.hypot(p.vx, p.vy);
        if (sp > 0.9) { p.vx = (p.vx / sp) * 0.9; p.vy = (p.vy / sp) * 0.9; }
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.gold ? "rgba(245,158,11,0.7)" : "rgba(139,92,246,0.7)";
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener("resize", resize); window.removeEventListener("mousemove", onMove); };
  }, []);
}

/* ════════════════════════════════════════════════
   MAIN ONBOARDING COMPONENT
   ════════════════════════════════════════════════ */
export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setOnboardingDone } = useAuth();
  const canvasRef = useRef(null);
  useParticles(canvasRef);

  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [phase, setPhase] = useState("greeting"); // greeting | question | compliment | farewell
  const [botMood, setBotMood] = useState("happy"); // happy | excited | thinking | celebrate
  const [showConfetti, setShowConfetti] = useState(false);
  const [saving, setSaving] = useState(false);

  /* Redirect if not logged in or already onboarded */
  useEffect(() => {
    if (!user) {
      navigate("/", { replace: true });
      return;
    }
    if (user.onboardingCompleted) {
      navigate("/", { replace: true });
    }
  }, [user, navigate]);

  /* Force dark theme */
  useEffect(() => {
    const prev = document.body.getAttribute("data-theme") || "dark";
    document.body.setAttribute("data-theme", "dark");
    return () => document.body.setAttribute("data-theme", prev);
  }, []);

  /* Preload speech voices and prime cache */
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      // Prime voice cache immediately if voices are available
      pickNaturalVoice();
      window.speechSynthesis.onvoiceschanged = () => {
        _cachedBotVoice.current = null; // reset cache on voice list change
        window.speechSynthesis.getVoices();
        pickNaturalVoice();
      };
    }
  }, []);

  /* Bot messages */
  const userName = user?.name?.split(" ")[0] || "Reader";

  const greetingText = `Hey ${userName}! I'm Readify Bot, your personal reading companion! Let me ask you a few quick questions to personalize your experience. Ready?`;
  const farewellText = `You're all set, ${userName}! I've personalized your Readify experience based on your preferences. Let's dive into your new digital library!`;

  const currentQuestion = QUESTIONS[currentQ];
  const questionText = currentQuestion ? `${currentQuestion.question}` : "";

  const getComplimentText = () => {
    if (!currentQuestion) return "";
    const answer = answers[currentQuestion.id];
    if (!answer) return "";
    if (Array.isArray(answer)) {
      const first = answer[0];
      return currentQuestion.compliments[first] || currentQuestion.compliments._default || "Great choice!";
    }
    return currentQuestion.compliments[answer] || "Great choice!";
  };

  /* Phase text for typing effect */
  const phaseText =
    phase === "greeting" ? greetingText :
      phase === "question" ? questionText :
        phase === "compliment" ? getComplimentText() :
          phase === "farewell" ? farewellText : "";

  const { displayed: typedText, done: typingDone } = useTypingEffect(phaseText, phase === "greeting" ? 20 : 18, true);

  /* 🔊 Bot speaks AFTER text finishes typing — text first, then voice */
  const [speechDone, setSpeechDone] = useState(false);

  // Reset speechDone when phase/text changes
  useEffect(() => {
    setSpeechDone(false);
  }, [phaseText]);

  const handleSpeechEnd = useCallback(() => {
    setSpeechDone(true);
  }, []);

  useBotSpeech(phaseText, typingDone, handleSpeechEnd);

  /* Handle greeting → first question */
  const handleStartQuiz = () => {
    setBotMood("thinking");
    setPhase("question");
  };

  /* Handle option selection */
  const handleOptionSelect = (value) => {
    if (!currentQuestion) return;

    if (currentQuestion.multiSelect) {
      setAnswers(prev => {
        const current = prev[currentQuestion.id] || [];
        if (current.includes(value)) {
          return { ...prev, [currentQuestion.id]: current.filter(v => v !== value) };
        }
        if (current.length >= (currentQuestion.maxSelect || 3)) return prev;
        return { ...prev, [currentQuestion.id]: [...current, value] };
      });
    } else {
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: value }));
      // Auto-advance after single-select with a brief delay for the selection animation
      setTimeout(() => {
        setBotMood("excited");
        setPhase("compliment");
      }, 400);
    }
  };

  /* Confirm multi-select */
  const handleConfirmMultiSelect = () => {
    const selected = answers[currentQuestion.id];
    if (!selected || selected.length === 0) return;
    setBotMood("excited");
    setPhase("compliment");
  };

  /* Move to next question */
  const handleNextQuestion = () => {
    if (currentQ < QUESTIONS.length - 1) {
      setCurrentQ(prev => prev + 1);
      setBotMood("thinking");
      setPhase("question");
    } else {
      // All done!
      setBotMood("celebrate");
      setPhase("farewell");
      setShowConfetti(true);
    }
  };

  /* Auto-advance from compliment — wait for BOTH typing AND speech to finish */
  useEffect(() => {
    if (phase === "compliment" && typingDone && speechDone) {
      const timer = setTimeout(() => handleNextQuestion(), 800);
      return () => clearTimeout(timer);
    }
  }, [phase, typingDone, speechDone]);

  /* Skip onboarding */
  const handleSkip = useCallback(async () => {
    if (saving) return;
    window.speechSynthesis.cancel();
    setSaving(true);
    try {
      await completeOnboarding();
      setOnboardingDone();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Skip error:", err);
      // Even on error, go home
      setOnboardingDone();
      navigate("/", { replace: true });
    }
  }, [saving, navigate, setOnboardingDone]);

  /* Finish onboarding — save preferences and go home */
  const handleFinish = useCallback(async () => {
    if (saving) return;
    window.speechSynthesis.cancel();
    setSaving(true);
    try {
      await savePreferences({
        favoriteGenres: answers.genres || [],
        readingFrequency: answers.frequency || "",
        readingGoal: answers.goal || "",
        preferredFormat: answers.format || "",
        excitedAbout: answers.excited || "",
      });
      setOnboardingDone();
      navigate("/", { replace: true });
    } catch (err) {
      console.error("Save preferences error:", err);
      // Even on error, go home
      setOnboardingDone();
      navigate("/", { replace: true });
    }
  }, [saving, answers, navigate, setOnboardingDone]);

  /* Guard: don't render if no user */
  if (!user || user.onboardingCompleted) return null;

  const isOptionSelected = (value) => {
    if (!currentQuestion) return false;
    const answer = answers[currentQuestion.id];
    if (Array.isArray(answer)) return answer.includes(value);
    return answer === value;
  };

  const multiSelectCount = () => {
    if (!currentQuestion?.multiSelect) return 0;
    return (answers[currentQuestion.id] || []).length;
  };

  return (
    <div className="ob-page">
      <canvas ref={canvasRef} className="ob-canvas" aria-hidden />

      {/* Skip button */}
      <button className="ob-skip-btn" onClick={handleSkip} disabled={saving}>
        Skip <i className="fas fa-arrow-right" />
      </button>

      {/* Progress bar */}
      {phase !== "greeting" && phase !== "farewell" && (
        <div className="ob-progress">
          {QUESTIONS.map((q, i) => (
            <div
              key={q.id}
              className={`ob-progress-dot ${i < currentQ ? "done" : ""} ${i === currentQ ? "active" : ""}`}
            />
          ))}
        </div>
      )}

      {showConfetti && <Confetti />}

      <div className="ob-container">
        {/* ── ROBOT ── */}
        <div className={`ob-robot-section ${botMood}`}>
          <div className="ob-robot-wrapper">
            {/* Glow ring */}
            <div className="ob-robot-glow" />

            {/* Robot body */}
            <div className={`ob-robot ${botMood}`}>
              {/* Antenna */}
              <div className="ob-antenna">
                <div className="ob-antenna-rod" />
                <div className="ob-antenna-tip" />
              </div>

              {/* Head */}
              <div className="ob-head">
                {/* Eyes */}
                <div className="ob-eyes">
                  <div className="ob-eye ob-eye-left">
                    <div className="ob-pupil" />
                    <div className="ob-eye-shine" />
                  </div>
                  <div className="ob-eye ob-eye-right">
                    <div className="ob-pupil" />
                    <div className="ob-eye-shine" />
                  </div>
                </div>
                {/* Mouth - smile */}
                <div className={`ob-mouth ${botMood}`}>
                  <div className="ob-mouth-curve" />
                </div>
                {/* Cheek blush */}
                <div className="ob-cheek ob-cheek-left" />
                <div className="ob-cheek ob-cheek-right" />
              </div>

              {/* Body */}
              <div className="ob-body">
                <div className="ob-body-screen">
                  <div className="ob-heart-icon">
                    {botMood === "celebrate" ? "🎉" : botMood === "excited" ? "⭐" : "📚"}
                  </div>
                </div>
              </div>

              {/* Arms */}
              <div className={`ob-arm ob-arm-left ${botMood === "excited" || botMood === "celebrate" ? "wave" : ""}`} />
              <div className={`ob-arm ob-arm-right ${botMood === "celebrate" ? "wave" : ""}`} />
            </div>
          </div>

          {/* Bot name label */}
          <div className="ob-bot-name">
            <span className="ob-bot-dot" /> Readify Bot
          </div>
        </div>

        {/* ── CHAT AREA ── */}
        <div className="ob-chat-section">
          {/* Chat bubble */}
          <div className={`ob-chat-bubble ${phase}`}>
            <div className="ob-chat-text">
              {typedText}
              {!typingDone && <span className="ob-cursor">|</span>}
            </div>

            {phase === "question" && currentQuestion?.subtitle && typingDone && (
              <div className="ob-chat-subtitle">{currentQuestion.subtitle}</div>
            )}
          </div>

          {/* Greeting action */}
          {phase === "greeting" && typingDone && (
            <div className="ob-action-area ob-fade-in">
              <button className="ob-start-btn" onClick={handleStartQuiz}>
                Let's Go! <span className="ob-btn-sparkle">✨</span>
              </button>
            </div>
          )}

          {/* Question options */}
          {phase === "question" && typingDone && currentQuestion && (
            <div className="ob-options-area ob-fade-in">
              <div className="ob-options-grid">
                {currentQuestion.options.map((opt, idx) => (
                  <button
                    key={opt.value}
                    className={`ob-option-card ${isOptionSelected(opt.value) ? "selected" : ""}`}
                    onClick={() => handleOptionSelect(opt.value)}
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  >
                    <span className="ob-option-icon">{opt.icon}</span>
                    <span className="ob-option-label">{opt.label}</span>
                    {isOptionSelected(opt.value) && <span className="ob-option-check">✓</span>}
                  </button>
                ))}
              </div>

              {currentQuestion.multiSelect && (
                <div className="ob-multi-action">
                  <span className="ob-multi-count">{multiSelectCount()}/{currentQuestion.maxSelect} selected</span>
                  <button
                    className="ob-confirm-btn"
                    onClick={handleConfirmMultiSelect}
                    disabled={multiSelectCount() === 0}
                  >
                    Confirm Selection <i className="fas fa-check" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Compliment phase - just the typing bubble, no action needed */}
          {phase === "compliment" && (
            <div className="ob-compliment-indicator ob-fade-in">
              <div className="ob-sparkle-dots">
                <span /><span /><span />
              </div>
            </div>
          )}

          {/* Farewell action */}
          {phase === "farewell" && typingDone && (
            <div className="ob-action-area ob-fade-in">
              <button className="ob-finish-btn" onClick={handleFinish} disabled={saving}>
                {saving ? "Setting up..." : "Enter Readify"} <span className="ob-btn-rocket">🚀</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
