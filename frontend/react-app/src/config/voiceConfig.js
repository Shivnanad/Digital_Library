// ═══════════════════════════════════════════════════
// READIFY VOICE ASSISTANT CONFIGURATION
// Alexa-style wake word system
// ═══════════════════════════════════════════════════

// Pages where voice is DISABLED (no mic, no listening)
export const VOICE_DISABLED_ROUTES = [
  '/login',
  '/register',
  '/onboarding',
  '/checkout',
  '/payment',
];

// Wake phrases - primary triggers + common speech-recognition mishearings
export const WAKE_PHRASES = [
  'hey readify',
  'readify',
  'hey ready fi',
  'hey ready fie',
  'hey ready fy',
  'hey ready fire',
  'hey read if i',
  'hey read a fi',
  'hey read a fie',
  'hey read a fy',
  'hey red a fi',
  'hey red a fie',
  'hey red if i',
  'hey reddit fi',
  'hey reddit fie',
  'hey readily',
  'hey read if eye',
  'hey ready phi',
  'hey ready five',
  'a readify',
  'ok readify',
  'hi readify',
  'hello readify',
  'ready fi',
  'ready fie',
  'ready fy',
  'read a fi',
  'read a fie',
  'read if i',
  'red a fi',
  'red if i',
  'reddit fi',
  'reddit fie',
  'read a fly',
  'ready fly',
  'ready figh',
  'read a figh',
  'read efi',
  'read e fi',
  'read efy',
  'read e fy',
  'readi fi',
  'readi fy',
];

// Fuzzy wake word matching: minimum similarity (0-1) required to trigger
export const WAKE_FUZZY_THRESHOLD = 0.58;

// How long to wait for a command after wake word (ms)
export const COMMAND_TIMEOUT = 5000;

// Silence timeout - if user says nothing for this long, go back to sleep (ms)
export const SILENCE_TIMEOUT = 8000;

// Minimum confidence to accept speech (0-1)
export const MIN_CONFIDENCE = 0.22;

// Noise patterns to reject
export const NOISE_PATTERNS = [
  /^(um|uh|ah|hmm|huh|mm){1,3}$/i,
  /^(beep|boop|buzz|ring|ding)s?$/i,
  /^(cough|sneeze|laugh|yawn|sigh)s?$/i,
];

// Navigation map - voice commands to routes
export const NAVIGATION_MAP = {
  'home': '/',
  'homepage': '/',
  'main page': '/',
  'books': '/books',
  'all books': '/books',
  'trending': '/trending',
  'trending books': '/trending',
  'new releases': '/new-releases',
  'new books': '/new-releases',
  'categories': '/categories',
  'category': '/categories',
  'wishlist': '/wishlist',
  'my wishlist': '/wishlist',
  'cart': '/cart',
  'my cart': '/cart',
  'shopping cart': '/cart',
  'account': '/account',
  'my account': '/account',
  'profile': '/account',
  'playlists': '/playlists',
  'my playlists': '/playlists',
  'search': '/search',
  'history': '/reading-history',
  'reading history': '/reading-history',
  'my reading history': '/reading-history',
  'library': '/my-library',
  'my library': '/my-library',
  'my books': '/my-library',
  'purchased books': '/my-library',
  'purchases': '/my-library',
};

// Common speech recognition corrections (misheard → intended)
export const SPEECH_CORRECTIONS = {
  'add to card': 'add to cart',
  'add to cut': 'add to cart',
  'add to cart': 'add to cart',
  'ad to cart': 'add to cart',
  'ad to card': 'add to cart',
  'at to cart': 'add to cart',
  'add to kart': 'add to cart',
  'dark mode': 'dark mode',
  'doc mode': 'dark mode',
  'dock mode': 'dark mode',
  'light mode': 'light mode',
  'lite mode': 'light mode',
  'night mode': 'dark mode',
  'day mode': 'light mode',
  'go to my libary': 'go to my library',
  'go to my liberty': 'go to my library',
  'go to library': 'go to my library',
  'go to my library': 'go to my library',
  'go to wish list': 'go to wishlist',
  'go to play list': 'go to playlists',
  'go to play lists': 'go to playlists',
  'go to reading history': 'go to reading history',
  'go to red in history': 'go to reading history',
  'switch to dark mode': 'dark mode',
  'switch to light mode': 'light mode',
  'switch to doc mode': 'dark mode',
  'switch to lite mode': 'light mode',
  'switch to night mode': 'dark mode',
  'switch to day mode': 'light mode',
  'turn on dark mode': 'dark mode',
  'turn on light mode': 'light mode',
  'enable dark mode': 'dark mode',
  'enable light mode': 'light mode',
  'go to account': 'go to account',
  'go to my account': 'go to my account',
  'go to profile': 'go to profile',
  'go home': 'go to home',
  'take me home': 'go to home',
  'open cart': 'go to cart',
  'open my cart': 'go to cart',
  // View details / open book corrections
  'you details': 'view details',
  'few details': 'view details',
  'view detail': 'view details',
  'view the details': 'view details',
  'open the book': 'open this book',
  'open this': 'open this book',
  'open that': 'open this book',
  'open that book': 'open this book',
  'opened': 'open it',
  'opened it': 'open it',
  'open the first': 'open first',
  'open the 1st': 'open first',
  'open the second': 'open second',
  'open the 2nd': 'open second',
  'the first one': 'first',
  'the second one': 'second',
  'the third one': 'third',
  'pick first': 'first',
  'pick second': 'second',
  'pick third': 'third',
  'select first': 'first',
  'select second': 'second',
  'select third': 'third',
};

// Category keywords for "show me horror books" type commands
export const CATEGORY_KEYWORDS = [
  'fiction', 'non-fiction', 'mystery', 'romance', 'science', 'history',
  'fantasy', 'horror', 'thriller', 'biography', 'self-help', 'comedy',
  'adventure', 'drama', 'poetry', 'philosophy', 'psychology', 'technology',
  'business', 'cooking', 'travel', 'art', 'music', 'sports', 'education',
  'children', 'young adult', 'classic', 'comic', 'manga', 'graphic novel',
];

// Ollama AI configuration
export const OLLAMA_CONFIG = {
  BASE_URL: 'http://localhost:11434',
  MODEL: 'neural-chat',
  TIMEOUT: 8000,
  RETRY_LIMIT: 2,
  RETRY_DELAY: 1000,
};
