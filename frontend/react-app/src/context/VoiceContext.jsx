import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  VOICE_DISABLED_ROUTES,
  WAKE_PHRASES,
  WAKE_FUZZY_THRESHOLD,
  COMMAND_TIMEOUT,
  SILENCE_TIMEOUT,
  MIN_CONFIDENCE,
  NOISE_PATTERNS,
  NAVIGATION_MAP,
  CATEGORY_KEYWORDS,
  SPEECH_CORRECTIONS,
} from '../config/voiceConfig';
import { useTheme } from './ThemeContext';
import { processVoiceCommand } from '../services/voiceService';
import { searchBooks, fetchBookById } from '../services/bookService';
import { addToCart } from '../services/cartService';

const VoiceContext = createContext();

const EMOTION_VOICE_PROFILES = {
  friendly: { rate: 1.03, pitch: 1.1, volume: 0.82 },
  calm: { rate: 0.95, pitch: 1.0, volume: 0.78 },
  excited: { rate: 1.12, pitch: 1.2, volume: 0.88 },
  empathetic: { rate: 0.94, pitch: 0.98, volume: 0.8 },
  neutral: { rate: 1.0, pitch: 1.04, volume: 0.8 },
};

function estimateSpeechDurationMs(text, rate = 1) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 1500;
  const normalizedRate = Math.max(0.75, Math.min(1.35, Number(rate) || 1));
  return Math.max(1500, Math.round((words * 420) / normalizedRate + 650));
}

// ═══════════════════════════════════════════════════
// READIFY VOICE ASSISTANT - Alexa-style
// States: sleeping → awake → processing → sleeping
// ═══════════════════════════════════════════════════

export const VoiceProvider = ({ children }) => {
  // ── State ──
  const [mode, setMode] = useState('sleeping');         // sleeping | awake | processing
  const [transcript, setTranscript] = useState('');      // Final recognized text
  const [interim, setInterim] = useState('');             // Interim text while speaking
  const [response, setResponse] = useState('');           // AI response text
  const [error, setError] = useState(null);
  const [isRouteAllowed, setIsRouteAllowed] = useState(true);
  const [micActive, setMicActive] = useState(false);      // Whether mic is physically listening

  // ── Refs ──
  const recognitionRef = useRef(null);
  const modeRef = useRef('sleeping');
  const silenceTimerRef = useRef(null);
  const commandTimerRef = useRef(null);
  const restartTimerRef = useRef(null);
  const isStoppedRef = useRef(false);
  const wakeCooldownRef = useRef(0);   // timestamp — ignore results until this time
  const femaleVoiceRef = useRef(null);  // cached female TTS voice
  const ttsActiveRef = useRef(false);   // true while TTS is speaking (blocks recognition restart)
  const lastSearchResultsRef = useRef([]); // last voice search results for disambiguation
  const disambiguatingRef = useRef(false); // true when waiting for user to pick a book
  const conversationHistoryRef = useRef([]); // short memory for chat-like replies

  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  // Keep modeRef synced
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Stable callback refs (avoid recreating recognition on every render) ──
  const wakeUpRef = useRef(null);
  const goToSleepRef = useRef(null);
  const processCommandRef = useRef(null);
  const containsWakePhraseRef = useRef(null);
  const extractCommandRef = useRef(null);
  const isNoiseRef = useRef(null);
  const startSilenceTimerRef = useRef(null);

  // ── Route check ──
  useEffect(() => {
    const path = location.pathname;
    const blocked = VOICE_DISABLED_ROUTES.some(r => {
      if (r === path) return true;
      if (r.includes(':')) {
        const pattern = r.replace(/:\w+/g, '[^/]+');
        return new RegExp(`^${pattern}$`).test(path);
      }
      return false;
    });
    setIsRouteAllowed(!blocked);

    if (blocked) {
      if (goToSleepRef.current) goToSleepRef.current();
    }
  }, [location.pathname]);

  // ── Helpers ──
  const clearAllTimers = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (commandTimerRef.current) { clearTimeout(commandTimerRef.current); commandTimerRef.current = null; }
    if (restartTimerRef.current) { clearTimeout(restartTimerRef.current); restartTimerRef.current = null; }
  }, []);

  const goToSleep = useCallback(() => {
    // Clear command/silence timers but NOT restart timer (recognition must keep running)
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (commandTimerRef.current) { clearTimeout(commandTimerRef.current); commandTimerRef.current = null; }
    disambiguatingRef.current = false; // exit disambiguation mode
    setMode('sleeping');
    setTranscript('');
    setInterim('');
    setResponse('');
    setError(null);

    // Cancel TTS only if VoiceContext was the one speaking (don't kill other components' speech)
    if (ttsActiveRef.current) {
      ttsActiveRef.current = false;
      try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch(e) {}
    }

    // Ensure recognition is running for wake word detection
    // Stop first (clean slate) then start after delay
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch(e) {}
    }
    setTimeout(() => {
      if (!isStoppedRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
          console.log('[Voice] Recognition restarted after goToSleep');
        } catch (e) {
          // Retry once more after 1s
          setTimeout(() => {
            if (!isStoppedRef.current && recognitionRef.current) {
              try { recognitionRef.current.start(); } catch (e2) { /* give up */ }
            }
          }, 1000);
        }
      }
    }, 600);
  }, []);

  // ── Play wake chime using Web Audio API ──
  const playWakeChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = (freq, start, duration, gain = 0.15) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        g.gain.setValueAtTime(gain, ctx.currentTime + start);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(g).connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };
      // Two-tone chime (like Alexa)
      playTone(880, 0, 0.15, 0.12);
      playTone(1174.66, 0.1, 0.2, 0.1);
    } catch (e) { /* Audio not available */ }
  }, []);

  // ── Select best voice (user preference or female fallback) ──
  const pickFemaleVoice = useCallback(() => {
    if (femaleVoiceRef.current) return femaleVoiceRef.current;
    const voices = window.speechSynthesis?.getVoices() || [];

    // ① Check user-saved preference from Account → Voice Settings
    const saved = localStorage.getItem("readify_voice");
    if (saved) {
      const match = voices.find(v => v.name === saved);
      if (match) {
        console.log(`[Voice] Using user-selected voice: ${match.name}`);
        femaleVoiceRef.current = match;
        return match;
      }
    }

    // ② Fallback: natural / high-quality English voices
    const priorities = [
      // Google voices (Chrome)
      v => /google.*female/i.test(v.name),
      v => /google.*uk.*female/i.test(v.name),
      // Explicit female names
      v => /zira|samantha|karen|moira|fiona|victoria|susan|hazel|heera|catherine|linda|emily|jenny|aria|sara|sonia/i.test(v.name),
      // Microsoft female voices  
      v => /microsoft.*(zira|hazel|susan|heera|catherine|linda|emily|jenny|aria|sara|sonia)/i.test(v.name),
      // Any voice with "female" in name
      v => /female/i.test(v.name),
      // English voices that are typically female by naming convention
      v => v.lang.startsWith('en') && !/male|david|mark|james|richard|george|daniel|ryan|guy|roger/i.test(v.name),
    ];
    for (const test of priorities) {
      const match = voices.find(v => v.lang.startsWith('en') && test(v));
      if (match) {
        console.log(`[Voice] Selected female voice: ${match.name}`);
        femaleVoiceRef.current = match;
        return match;
      }
    }
    // Fallback: first English voice
    const eng = voices.find(v => v.lang.startsWith('en'));
    if (eng) femaleVoiceRef.current = eng;
    return eng || null;
  }, []);

  // Load voices (they load async in most browsers)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    // Try immediately
    pickFemaleVoice();
    // Also listen for async load
    const onVoicesChanged = () => {
      femaleVoiceRef.current = null; // reset cache
      pickFemaleVoice();
    };
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);

    // Listen for user voice-change from Account settings
    const onUserVoiceChange = () => {
      femaleVoiceRef.current = null; // clear cache so next speak() re-picks
      pickFemaleVoice();
    };
    window.addEventListener('readify-voice-changed', onUserVoiceChange);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      window.removeEventListener('readify-voice-changed', onUserVoiceChange);
    };
  }, [pickFemaleVoice]);

  // ── Speak response using TTS (female voice, pauses recognition to avoid self-hearing) ──
  const speak = useCallback((text, options = {}) => {
    const safeText = String(text || '').trim();
    const emotionKey = String(options.emotion || 'friendly').toLowerCase();
    const profile = EMOTION_VOICE_PROFILES[emotionKey] || EMOTION_VOICE_PROFILES.friendly;
    const rate = typeof options.rate === 'number' ? options.rate : profile.rate;
    const pitch = typeof options.pitch === 'number' ? options.pitch : profile.pitch;
    const volume = typeof options.volume === 'number' ? options.volume : profile.volume;
    const estimatedMs = estimateSpeechDurationMs(safeText, rate);

    if (!safeText) return estimatedMs;

    try {
      if ('speechSynthesis' in window) {
        // Mark TTS as active so recognition.onend doesn't restart while we're speaking
        ttsActiveRef.current = true;
        // Pause recognition while speaking to avoid picking up our own voice
        if (recognitionRef.current) {
          try { recognitionRef.current.stop(); } catch(e) {}
        }
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(safeText);
        // Set female voice
        const voice = pickFemaleVoice();
        if (voice) utter.voice = voice;
        utter.rate = Math.max(0.75, Math.min(1.35, rate));
        utter.pitch = Math.max(0.8, Math.min(1.4, pitch));
        utter.volume = Math.max(0.4, Math.min(1, volume));
        utter.onend = () => {
          // TTS finished — safe to resume recognition
          ttsActiveRef.current = false;
          if (!isStoppedRef.current && recognitionRef.current) {
            setTimeout(() => {
              try { recognitionRef.current.start(); } catch(e) {}
            }, 300);
          }
        };
        utter.onerror = () => {
          // TTS failed — still resume recognition
          ttsActiveRef.current = false;
          if (!isStoppedRef.current && recognitionRef.current) {
            setTimeout(() => {
              try { recognitionRef.current.start(); } catch(e) {}
            }, 300);
          }
        };
        window.speechSynthesis.speak(utter);
      }
    } catch (e) {
      ttsActiveRef.current = false;
    }

    return estimatedMs;
  }, [pickFemaleVoice]);

  // ── Start silence timer (called after TTS finishes, not at wakeUp time) ──
  const startSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      if (modeRef.current === 'awake' && !disambiguatingRef.current) {
        setResponse('No command heard. Going back to sleep.');
        speak('Going back to sleep.');
        setTimeout(() => goToSleep(), 1500);
      }
    }, SILENCE_TIMEOUT);
  }, [goToSleep, speak]);

  const wakeUp = useCallback(() => {
    // Clear command/silence timers only (not restart timer)
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (commandTimerRef.current) { clearTimeout(commandTimerRef.current); commandTimerRef.current = null; }
    setMode('awake');
    setTranscript('');
    setInterim('');
    setResponse('Hi! How can I help?');
    setError(null);

    // Cooldown: ignore results for 2.5s (covers TTS speaking time)
    wakeCooldownRef.current = Date.now() + 2500;

    // Audio feedback: chime + TTS greeting
    playWakeChime();
    setTimeout(() => speak('How can I help?'), 250);

    // Start silence timer AFTER cooldown ends (so user gets full 8s to respond)
    setTimeout(() => {
      if (modeRef.current === 'awake') {
        startSilenceTimer();
      }
    }, 2800); // Start counting after TTS finishes + recognition restarts
  }, [goToSleep, playWakeChime, speak, startSilenceTimer]);

  // ── Check if text is noise ──
  const isNoise = useCallback((text) => {
    if (!text || text.trim().length < 2) return true;
    const clean = text.trim().toLowerCase();
    return NOISE_PATTERNS.some(p => p.test(clean));
  }, []);

  // ── Fuzzy string similarity (Levenshtein-based) ──
  const similarity = useCallback((a, b) => {
    if (a === b) return 1;
    const la = a.length, lb = b.length;
    if (!la || !lb) return 0;
    const matrix = Array.from({ length: la + 1 }, (_, i) =>
      Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= la; i++) {
      for (let j = 1; j <= lb; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }
    return 1 - matrix[la][lb] / Math.max(la, lb);
  }, []);

  const normalizeSpeech = useCallback((text) => {
    return (text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const wakeStemPattern = useRef(/\b(hey\s+)?(read|red|ready|readi|redi|readify|readyfi|ready\s*fi|read\s*a\s*fi|reddit\s*fi|read\s*e\s*fi)\b/i);

  // ── Check for wake phrase (exact + fuzzy) ──
  const containsWakePhrase = useCallback((text, confidence = 0, isFinal = false) => {
    const clean = normalizeSpeech(text);
    if (!clean) return false;

    if (wakeStemPattern.current.test(clean) && /\b(fi|fy|fie|five|phi|fly|fire)\b/i.test(clean)) {
      return true;
    }

    // 1. Exact match (fast path)
    if (WAKE_PHRASES.some(phrase => clean.includes(phrase))) return true;

    // 2. Fuzzy match — split input into sliding windows and compare to each wake phrase
    const words = clean.split(' ');
    const adaptiveThreshold = Math.max(
      0.5,
      WAKE_FUZZY_THRESHOLD - (confidence > 0 ? 0.06 : 0) - (isFinal ? 0.03 : 0)
    );

    for (const phrase of WAKE_PHRASES) {
      const phraseWords = phrase.split(' ').length;
      for (let i = 0; i <= words.length - phraseWords; i++) {
        const window = words.slice(i, i + phraseWords).join(' ');
        const score = similarity(window, phrase);
        if (score >= adaptiveThreshold) {
          console.log(`[Voice] Fuzzy wake match: "${window}" ≈ "${phrase}" (${(similarity(window, phrase) * 100).toFixed(0)}%)`);
          return true;
        }
      }
    }

    return false;
  }, [normalizeSpeech, similarity]);

  // ── Strip ALL wake phrases from text ──
  const stripWakePhrases = useCallback((text) => {
    let clean = normalizeSpeech(text);
    // Remove all wake phrases (longest first to avoid partial matches)
    const sorted = [...WAKE_PHRASES].sort((a, b) => b.length - a.length);
    for (const phrase of sorted) {
      clean = clean.replace(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ');
    }
    clean = clean.replace(/\b(hey\s+)?(read|red|ready|readi|redi|readify|readyfi|ready\s*fi|read\s*a\s*fi|reddit\s*fi|read\s*e\s*fi)(\s+(fi|fy|fie|five|phi|fly|fire))?\b/gi, ' ');
    return clean.replace(/\s+/g, ' ').trim();
  }, [normalizeSpeech]);

  // ── Check if text is ONLY a wake phrase (nothing else meaningful) ──
  const isOnlyWakePhrase = useCallback((text) => {
    const stripped = stripWakePhrases(text);
    return stripped.length < 2;
  }, [stripWakePhrases]);

  // ── Extract command after wake word ──
  const extractCommand = useCallback((text) => {
    return stripWakePhrases(text);
  }, [stripWakePhrases]);

  // ── Auto-correct common speech recognition mishearings ──
  const autoCorrect = useCallback((text) => {
    let clean = text.toLowerCase().trim();
    // Check full phrase match first
    if (SPEECH_CORRECTIONS[clean]) return SPEECH_CORRECTIONS[clean];
    // Check partial replacement
    for (const [wrong, right] of Object.entries(SPEECH_CORRECTIONS)) {
      if (clean.includes(wrong)) {
        clean = clean.replace(wrong, right);
      }
    }
    return clean;
  }, []);

  // ── Try to handle command locally first (fast) ──
  const tryLocalCommand = useCallback((command) => {
    // Apply autocorrect first
    const clean = autoCorrect(command);

    // 0. Theme toggle: "dark mode", "light mode", "switch to dark mode"
    if (/\b(dark|night)\s*(mode|theme)\b/i.test(clean) || clean === 'dark mode') {
      if (theme !== 'dark') toggleTheme();
      return { handled: true, response: 'Switched to dark mode' };
    }
    if (/\b(light|day|lite)\s*(mode|theme)\b/i.test(clean) || clean === 'light mode') {
      if (theme !== 'light') toggleTheme();
      return { handled: true, response: 'Switched to light mode' };
    }
    if (/\b(toggle|switch)\s*(the)?\s*(theme|mode)\b/i.test(clean)) {
      toggleTheme();
      return { handled: true, response: `Switched to ${theme === 'dark' ? 'light' : 'dark'} mode` };
    }

    // 1. Disambiguation selection (highest priority when disambiguating)
    if (disambiguatingRef.current && lastSearchResultsRef.current.length > 0) {
      const ordinals = { 'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5 };
      let picked = null;
      // Direct number: "1", "2"
      const numMatch = clean.match(/^\s*(\d+)\s*$/);
      if (numMatch) picked = parseInt(numMatch[1]);
      // "number 2", "option 3", "the 2nd"
      const numWordMatch = clean.match(/(?:number|option|book)\s*(\d+)/i);
      if (!picked && numWordMatch) picked = parseInt(numWordMatch[1]);
      // Ordinal: "the first one", "second one", "third"
      if (!picked) {
        for (const [word, num] of Object.entries(ordinals)) {
          if (clean.includes(word)) { picked = num; break; }
        }
      }
      // "open 1", "open the first", "open number 2"
      const openNumMatch = clean.match(/(?:open|select|choose|pick)\s*(?:number|option|book)?\s*(\d+)/i);
      if (!picked && openNumMatch) picked = parseInt(openNumMatch[1]);
      if (!picked) {
        for (const [word, num] of Object.entries(ordinals)) {
          if (clean.match(new RegExp(`(?:open|select|choose|pick)\\s*(?:the\\s*)?${word}`, 'i'))) { picked = num; break; }
        }
      }
      // Title match: user says partial title
      if (!picked) {
        const results = lastSearchResultsRef.current;
        for (let i = 0; i < results.length; i++) {
          const title = results[i].title.toLowerCase();
          if (title.includes(clean) || clean.includes(title.substring(0, Math.min(20, title.length)))) {
            picked = i + 1;
            break;
          }
        }
      }
      if (picked && picked >= 1 && picked <= lastSearchResultsRef.current.length) {
        const book = lastSearchResultsRef.current[picked - 1];
        disambiguatingRef.current = false;
        return { handled: true, response: `Opening ${book.title}`, action: 'open_book_direct', bookId: book._id, bookTitle: book.title };
      }
      if (picked) {
        return { handled: true, response: `I only found ${lastSearchResultsRef.current.length} books. Pick a number from 1 to ${lastSearchResultsRef.current.length}.` };
      }
    }

    // 2. Open / View details: "open this book", "view details", "open it"
    const bookOpenWords = ['open this book', 'open this', 'open it', 'view details', 'show details', 'open details', 'open the book', 'view this book', 'view book'];
    const isBookOpenCommand = bookOpenWords.includes(clean) || 
      /^(open|view|show)\s+(this|the|that)\s*(book|details|one|page)?$/i.test(clean) ||
      /^(view|show)\s+(details|book)$/i.test(clean);

    if (isBookOpenCommand) {
      // If already on a book detail page
      const bookMatch = location.pathname.match(/\/book\/([a-zA-Z0-9]+)/);
      if (bookMatch) {
        return { handled: true, response: 'You are already viewing this book.' };
      }
      // If we have search results from a previous voice search
      const results = lastSearchResultsRef.current;
      if (results.length === 1) {
        return { handled: true, response: `Opening ${results[0].title}`, action: 'open_book_direct', bookId: results[0]._id, bookTitle: results[0].title };
      } else if (results.length > 1) {
        return { handled: true, response: '', action: 'disambiguate', results };
      }
      return { handled: true, response: 'No search results to open. Try saying "search" followed by a book name first.' };
    }

    // 3. Navigation: "go to cart", "open wishlist", "take me home"
    const navPrefixes = ['go to ', 'open ', 'take me to ', 'navigate to ', 'show me ', 'show ', 'go '];
    let navTarget = null;
    for (const prefix of navPrefixes) {
      if (clean.startsWith(prefix)) {
        navTarget = clean.substring(prefix.length).trim();
        break;
      }
    }
    // Direct match: just "cart", "home", "wishlist", "my library"
    if (!navTarget) navTarget = clean;

    if (NAVIGATION_MAP[navTarget]) {
      navigate(NAVIGATION_MAP[navTarget]);
      return { handled: true, response: `Going to ${navTarget}` };
    }

    // 4. Search: "search for fantasy books", "find horror", "look for harry potter"
    const searchPrefixes = ['search for ', 'search ', 'find ', 'look for ', 'look up '];
    for (const prefix of searchPrefixes) {
      if (clean.startsWith(prefix)) {
        const query = clean.substring(prefix.length).trim();
        if (query) {
          return { handled: true, response: `Searching for "${query}"`, action: 'voice_search', query };
        }
      }
    }

    // 3. Category: "show me horror books", "fantasy books", "horror"
    for (const cat of CATEGORY_KEYWORDS) {
      if (clean.includes(cat)) {
        navigate(`/search?q=${encodeURIComponent(cat)}`);
        return { handled: true, response: `Showing ${cat} books` };
      }
    }

    // 4. Add to cart: "add to cart", "add this to cart"
    if (/\badd\b.*\bcart\b/i.test(clean) || clean.includes('add to cart')) {
      // Get book ID from current URL if on book detail page
      const bookMatch = location.pathname.match(/\/book\/([a-zA-Z0-9]+)/);
      if (bookMatch) {
        return { handled: true, response: 'Adding to cart...', action: 'add_to_cart', bookId: bookMatch[1] };
      }
      return { handled: true, response: 'Please open a book page first to add to cart' };
    }

    // 5. Add to wishlist
    if (clean.includes('add to wishlist') || clean.includes('save this') || clean.includes('favorite')) {
      return { handled: true, response: 'Adding to wishlist...', action: 'add_to_wishlist' };
    }

    // 6. Help / identity
    if (clean === 'help' || clean.includes('what can you do') || clean.includes('what do you do')) {
      return {
        handled: true,
        response: 'I can: search books, navigate pages, add to cart, switch dark/light mode. Try "search fantasy" or "go to cart"',
      };
    }

    if (/\b(what(?:'s|s| is)?\s*(?:your|ur)\s*(?:name|same)|tell me\s*(?:your|ur)\s*(?:name|same)|who\s*(?:are|r)\s*you|introduce yourself)\b/i.test(clean)) {
      return {
        handled: true,
        response: 'I am Readify AI, your voice assistant.',
      };
    }

    // 7. Stop / cancel / bye
    if (['stop', 'cancel', 'bye', 'goodbye', 'go to sleep', 'shut up', 'never mind', 'nevermind'].includes(clean)) {
      return { handled: true, response: 'Goodbye!', action: 'sleep' };
    }

    return { handled: false };
  }, [navigate, theme, toggleTheme, autoCorrect, location.pathname]);

  // ── Process command (local first, then AI) ──
  const processCommand = useCallback(async (commandText) => {
    if (!commandText || commandText.trim().length === 0) {
      goToSleep();
      return;
    }

    const safeCommandText = commandText.trim();

    const addConversationTurn = (role, text) => {
      const content = String(text || '').trim();
      if (!content) return;
      conversationHistoryRef.current.push({ role, content });
      if (conversationHistoryRef.current.length > 12) {
        conversationHistoryRef.current = conversationHistoryRef.current.slice(-12);
      }
    };

    const shouldSearchFallback = (text) => {
      const normalized = autoCorrect(String(text || '').toLowerCase().trim());
      if (normalized.length < 3) return false;
      const nonSearchCommands = [
        /^(help|stop|cancel|bye|goodbye|go to sleep|sleep|never mind|nevermind)$/i,
        /\b(add to cart|add this to cart|add to wishlist|save this|favorite)\b/i,
        /\b(dark mode|light mode|toggle theme|switch theme)\b/i,
        /\b(what(?:'s|s| is)?\s*(?:your|ur)\s*(?:name|same)|tell me\s*(?:your|ur)\s*(?:name|same)|who\s*(?:are|r)\s*you|introduce yourself)\b/i,
      ];
      return !nonSearchCommands.some((pattern) => pattern.test(normalized));
    };

    setTranscript(safeCommandText);
    setInterim('');
    addConversationTurn('user', safeCommandText);

    // Try local command first (instant, no API call)
    const local = tryLocalCommand(safeCommandText);
    if (local.handled) {
      setResponse(local.response);
      if (local.response) addConversationTurn('assistant', local.response);
      // Speak the response for audio feedback (skip for actions that manage their own TTS)
      if (local.action !== 'sleep' && local.action !== 'voice_search' && local.action !== 'disambiguate') {
        speak(local.response);
      }

      // Execute actions that need async work
      if (local.action === 'voice_search' && local.query) {
        // Actually search and store results for disambiguation
        try {
          const results = await searchBooks(local.query, 5);
          lastSearchResultsRef.current = results || [];
          const count = results?.length || 0;
          if (count === 0) {
            const message = `No books found for "${local.query}"`;
            setResponse(message);
            addConversationTurn('assistant', message);
            speak(`No books found for ${local.query}`, { emotion: 'calm' });
          } else if (count === 1) {
            const message = `Found "${results[0].title}". Say "open it" to view details.`;
            setResponse(message);
            addConversationTurn('assistant', message);
            speak(`Found ${results[0].title}. Say open it to view details.`, { emotion: 'friendly' });
          } else {
            const message = `Found ${count} books. Say "open" or pick a number.`;
            setResponse(message);
            addConversationTurn('assistant', message);
            speak(`I found ${count} books. Say open to choose, or say a number.`, { emotion: 'friendly' });
          }
          navigate(`/search?q=${encodeURIComponent(local.query)}`);
        } catch (e) {
          const message = `Searching for "${local.query}"`;
          setResponse(message);
          addConversationTurn('assistant', message);
          navigate(`/search?q=${encodeURIComponent(local.query)}`);
        }
        setTimeout(() => goToSleep(), 3500);
        return;
      }

      if (local.action === 'open_book_direct' && local.bookId) {
        navigate(`/book/${local.bookId}`);
        disambiguatingRef.current = false;
        setTimeout(() => goToSleep(), 2000);
        return;
      }

      if (local.action === 'disambiguate' && local.results) {
        // Enter disambiguation mode — ask user to pick
        disambiguatingRef.current = true;
        const top = local.results.slice(0, 5);
        const listText = top.map((b, i) => `${i + 1}. ${b.title}`).join('. ');
        const displayList = top.map((b, i) => `${i + 1}. ${b.title}`).join('\n');
        setResponse(`Which one?\n${displayList}`);
        addConversationTurn('assistant', 'Which one exactly? Say a number to open.');
        speak(`Which one exactly? ${listText}. Say a number to open.`, { emotion: 'friendly' });
        // Stay awake longer for disambiguation
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          if (modeRef.current === 'awake') {
            disambiguatingRef.current = false;
            const message = 'No selection made. Going back to sleep.';
            setResponse(message);
            addConversationTurn('assistant', message);
            setTimeout(() => goToSleep(), 1500);
          }
        }, 10000); // 10s timeout for disambiguation
        return; // Stay awake, don't go to sleep
      }

      if (local.action === 'add_to_cart' && local.bookId) {
        try {
          const book = await fetchBookById(local.bookId);
          if (book) {
            addToCart(book);
            const message = `Added "${book.title}" to cart!`;
            setResponse(message);
            addConversationTurn('assistant', message);
            speak(`Added ${book.title} to cart`, { emotion: 'excited' });
          } else {
            const message = 'Could not find this book.';
            setResponse(message);
            addConversationTurn('assistant', message);
            speak('Could not find this book', { emotion: 'calm' });
          }
        } catch (e) {
          const message = 'Failed to add to cart. Try again.';
          setResponse(message);
          addConversationTurn('assistant', message);
          speak('Failed to add to cart', { emotion: 'calm' });
        }
      }

      if (local.action === 'sleep') {
        speak('Goodbye', { emotion: 'calm' });
        setTimeout(() => goToSleep(), 1000);
      } else {
        setTimeout(() => goToSleep(), 2500);
      }
      return;
    }

    // If local didn't handle it, send to AI backend
    setMode('processing');
    setResponse('Thinking...');
    const thinkingStartedAt = Date.now();

    try {
      const result = await processVoiceCommand({
        transcript: safeCommandText,
        history: conversationHistoryRef.current.slice(-8),
      });

      const thinkingElapsed = Date.now() - thinkingStartedAt;
      if (thinkingElapsed < 650) {
        await new Promise((resolve) => setTimeout(resolve, 650 - thinkingElapsed));
      }

      setMode('awake');

      const data = result && result.data ? result.data : {};
      const intent = String(data.intent || 'unknown').toLowerCase();
      const query = String(data.query || '').trim();
      const bookTitle = String(data.bookTitle || '').trim();
      const action = String(data.action || '').trim();
      const emotion = String(data.emotion || 'friendly').toLowerCase();
      let spokenReply = String(data.response || '').trim();

      switch (intent) {
        case 'search': {
          const effectiveQuery = query || safeCommandText;
          navigate(`/search?q=${encodeURIComponent(effectiveQuery)}`);
          if (!spokenReply) spokenReply = action || `Searching for "${effectiveQuery}"`;
          break;
        }
        case 'open_book':
          if (bookTitle) {
            navigate(`/search?q=${encodeURIComponent(bookTitle)}`);
            if (!spokenReply) spokenReply = action || `Opening results for "${bookTitle}"`;
          } else if (shouldSearchFallback(safeCommandText)) {
            navigate(`/search?q=${encodeURIComponent(safeCommandText)}`);
            if (!spokenReply) spokenReply = action || `Searching for "${safeCommandText}"`;
          } else if (!spokenReply) {
            spokenReply = action || 'Tell me which book you want to open.';
          }
          break;
        case 'navigate': {
          const navTarget = query.toLowerCase();
          if (query && NAVIGATION_MAP[navTarget]) {
            navigate(NAVIGATION_MAP[navTarget]);
            if (!spokenReply) spokenReply = action || `Opening ${query}`;
          } else if (shouldSearchFallback(safeCommandText)) {
            navigate(`/search?q=${encodeURIComponent(safeCommandText)}`);
            if (!spokenReply) spokenReply = action || `Searching for "${safeCommandText}"`;
          } else if (!spokenReply) {
            spokenReply = action || 'Tell me where you want to go.';
          }
          break;
        }
        case 'add_to_cart':
          if (!spokenReply) spokenReply = action || 'Use this on a book page to add to cart.';
          break;
        case 'help':
          if (!spokenReply) spokenReply = action || 'Try saying search fantasy or go to wishlist.';
          break;
        default:
          if (shouldSearchFallback(safeCommandText)) {
            navigate(`/search?q=${encodeURIComponent(safeCommandText)}`);
            if (!spokenReply) spokenReply = action || `Searching for "${safeCommandText}"`;
          } else if (!spokenReply) {
            spokenReply = action || 'I did not understand that. Please try again.';
          }
      }

      if (!spokenReply) {
        spokenReply = shouldSearchFallback(safeCommandText)
          ? `Searching for "${safeCommandText}"`
          : 'I can help with that.';
      }

      setResponse(spokenReply);
      addConversationTurn('assistant', spokenReply);
      const spokenDurationMs = speak(spokenReply, { emotion });

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setTimeout(() => {
        if (modeRef.current === 'awake' && startSilenceTimerRef.current) {
          startSilenceTimerRef.current();
        }
      }, Math.min(spokenDurationMs + 450, 6500));
    } catch (err) {
      console.error('[Voice] AI processing failed:', err.message);
      setMode('awake');

      // Fallback: treat as search (but only if it's not just a wake phrase)
      const stripped = safeCommandText.toLowerCase().replace(/[.,!?;:\-()]/g, '').trim();
      const isWake = WAKE_PHRASES.some(p => stripped === p || stripped.replace(/\s+/g, ' ') === p);

      let fallbackReply = '';
      if (!isWake && stripped.length > 2) {
        fallbackReply = `Searching for "${safeCommandText}"`;
        navigate(`/search?q=${encodeURIComponent(safeCommandText)}`);
      } else {
        fallbackReply = 'I did not catch that. Please try again.';
      }

      setResponse(fallbackReply);
      addConversationTurn('assistant', fallbackReply);
      const spokenDurationMs = speak(fallbackReply, { emotion: 'calm' });

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setTimeout(() => {
        if (modeRef.current === 'awake' && startSilenceTimerRef.current) {
          startSilenceTimerRef.current();
        }
      }, Math.min(spokenDurationMs + 400, 6000));
    }
  }, [goToSleep, tryLocalCommand, navigate, speak, autoCorrect]);

  // ── Keep callback refs in sync (so recognition effect doesn't need to re-run) ──
  useEffect(() => {
    wakeUpRef.current = wakeUp;
    goToSleepRef.current = goToSleep;
    processCommandRef.current = processCommand;
    containsWakePhraseRef.current = containsWakePhrase;
    extractCommandRef.current = extractCommand;
    isNoiseRef.current = isNoise;
    startSilenceTimerRef.current = startSilenceTimer;
  });

  // ══════════════════════════════════════════
  // SPEECH RECOGNITION SETUP (runs ONCE)
  // ══════════════════════════════════════════
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Voice] Speech Recognition not supported');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    const preferredLangs = ['en-IN', 'en-US', 'en-GB'];
    const browserLangs = [
      ...(navigator.languages || []),
      navigator.language,
      'en-IN',
      'en-US'
    ].filter(Boolean);
    recognition.lang = browserLangs.find(l => preferredLangs.includes(l)) || 'en-IN';
    recognition.maxAlternatives = 8;

    // ── onstart ──
    recognition.onstart = () => {
      isStoppedRef.current = false;
      setMicActive(true);
      console.log('[Voice] 🎤 Mic active — listening for "Hey Readify"');
    };

    // ── onresult ── The core logic
    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      let confidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        confidence = result[0].confidence || 0;

        // Check ALL alternatives for wake phrase (speech engine's top guesses)
        if (modeRef.current === 'sleeping') {
          for (let alt = 0; alt < result.length; alt++) {
            const altText = result[alt].transcript;
            const altConfidence = result[alt].confidence || confidence || 0;
            if (containsWakePhraseRef.current(altText, altConfidence, result.isFinal)) {
              console.log(`[Voice] Wake phrase found in alt ${alt}: "${altText}"`);
              wakeUpRef.current();
              return;
            }
          }
        }

        if (result.isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      // ── SLEEPING MODE: double-check combined text for wake phrase ──
      if (modeRef.current === 'sleeping') {
        const combined = (finalText + ' ' + interimText).trim();
        if (combined && containsWakePhraseRef.current(combined, confidence, finalText.length > 0)) {
          console.log(`[Voice] Wake phrase found in combined text: "${combined}"`);
          wakeUpRef.current();
          return;
        }
      }

      // Log what the speech engine heard (for debugging wake word issues)
      if (modeRef.current === 'sleeping' && (finalText || interimText)) {
        const heard = finalText || interimText;
        if (heard.trim().length > 1) {
          console.log(`[Voice] Heard (sleeping): "${heard.trim()}" — not a wake phrase`);
        }
      }

      // ── SLEEPING MODE: already handled above in alternatives loop ──
      // Any remaining text in sleeping mode that wasn't caught → ignore
      if (modeRef.current === 'sleeping') {
        return;
      }

      // ── AWAKE MODE: listen for commands ──
      if (modeRef.current === 'awake') {
        // During cooldown, discard everything (stale wake-phrase utterance)
        if (Date.now() < wakeCooldownRef.current) {
          return;
        }

        if (interimText) {
          // Show interim but strip wake phrases from display
          const displayInterim = extractCommandRef.current(interimText);
          setInterim(displayInterim || interimText);
          // Reset silence timer — user is speaking
          if (startSilenceTimerRef.current) startSilenceTimerRef.current();
        }

        if (finalText) {
          const clean = finalText.trim();
          if (isNoiseRef.current && isNoiseRef.current(clean)) return;
          const dynamicMinConfidence = Math.max(0.12, MIN_CONFIDENCE - (clean.split(/\s+/).length >= 3 ? 0.1 : 0.04));
          if (confidence > 0 && confidence < dynamicMinConfidence) return;

          // Always strip wake phrases from the command
          const command = extractCommandRef.current(clean);

          // If only wake phrase with no actual command, just re-wake (stay listening)
          if (!command || command.length < 2) {
            console.log('[Voice] Heard wake phrase only in awake mode — still listening');
            wakeUpRef.current();
            return;
          }

          processCommandRef.current(command);
        }
      }
    };

    // ── onerror ──
    recognition.onerror = (event) => {
      console.warn('[Voice] Recognition error:', event.error);
      if (['aborted', 'no-speech'].includes(event.error)) return;
      if (event.error === 'not-allowed') {
        setError('Microphone permission denied. Check browser settings.');
        setMicActive(false);
        if (goToSleepRef.current) goToSleepRef.current();
      } else if (event.error === 'network') {
        console.warn('[Voice] Network error — will retry');
      }
    };

    // ── onend ── Auto-restart (always keep recognition alive)
    recognition.onend = () => {
      setMicActive(false);
      if (isStoppedRef.current) return;

      // If TTS is actively speaking, do NOT restart recognition
      // (speak's utter.onend will restart it when TTS finishes)
      if (ttsActiveRef.current) {
        console.log('[Voice] Recognition ended during TTS — waiting for TTS to finish');
        return;
      }

      console.log('[Voice] Recognition ended — restarting...');
      // Clear any existing restart timer to avoid doubles
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      restartTimerRef.current = setTimeout(() => {
        if (!isStoppedRef.current && recognitionRef.current && !ttsActiveRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            // If start fails, retry after a longer delay
            console.warn('[Voice] Restart failed, retrying in 1s...');
            restartTimerRef.current = setTimeout(() => {
              if (!isStoppedRef.current && recognitionRef.current && !ttsActiveRef.current) {
                try { recognitionRef.current.start(); } catch (e2) { /* give up */ }
              }
            }, 1000);
          }
        }
      }, 400);
    };

    recognitionRef.current = recognition;

    // Auto-start
    try { recognition.start(); } catch (e) { /* ignore */ }

    return () => {
      isStoppedRef.current = true;
      try { recognition.stop(); } catch (e) { /* ignore */ }
    };
  }, []); // ← Empty deps: runs ONCE, never re-creates

  // ── Start/stop based on route ──
  useEffect(() => {
    if (!recognitionRef.current) return;

    if (isRouteAllowed) {
      isStoppedRef.current = false;
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Already started
      }
    } else {
      isStoppedRef.current = true;
      if (goToSleepRef.current) goToSleepRef.current();
      try {
        recognitionRef.current.stop();
      } catch (e) { /* ignore */ }
    }
  }, [isRouteAllowed]);

  // ── Public API ──
  const dismissAssistant = useCallback(() => {
    goToSleep();
  }, [goToSleep]);

  // Pause background recognition (for Navbar voice search)
  const pauseRecognition = useCallback(() => {
    isStoppedRef.current = true;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { /* ignore */ }
    }
  }, []);

  // Resume background recognition
  const resumeRecognition = useCallback(() => {
    if (!isRouteAllowed) return;
    isStoppedRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.start(); } catch (e) { /* ignore */ }
    }
  }, [isRouteAllowed]);

  // Manual wake-up for Readify AI logo click
  const manualWakeUp = useCallback(() => {
    if (modeRef.current === 'sleeping') {
      wakeUp();
    }
  }, [wakeUp]);

  const value = {
    mode,           // 'sleeping' | 'awake' | 'processing'
    transcript,     // final recognized text
    interim,        // interim text while speaking
    response,       // AI/system response
    error,
    isRouteAllowed,
    micActive,      // whether mic is physically listening
    dismissAssistant,
    pauseRecognition,
    resumeRecognition,
    manualWakeUp,   // manual activation from logo click
  };

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
};

export const useVoice = () => {
  const context = useContext(VoiceContext);
  if (!context) throw new Error('useVoice must be used within VoiceProvider');
  return context;
};
