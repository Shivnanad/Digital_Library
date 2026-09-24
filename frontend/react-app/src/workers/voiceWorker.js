// Web Worker for continuous voice recognition
// Runs in background thread - does NOT freeze the main UI thread

let recognition;
let isListening = false;
let lastTranscript = '';
let debounceTimer;

// Fallback for webkit prefix
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Initialize speech recognition
 */
function initRecognition() {
  if (recognition) return;

  if (!SpeechRecognition) {
    postMessage({ type: 'error', message: 'Speech Recognition API not supported in this browser' });
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.language = 'en-US';

  recognition.onstart = () => {
    console.log('[Worker] Recognition started');
    postMessage({ type: 'status', status: 'listening' });
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;

      if (event.results[i].isFinal) {
        lastTranscript = transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    // Send interim results
    if (interimTranscript) {
      postMessage({
        type: 'interim',
        text: interimTranscript,
      });
    }

    // Send final result with debounce
    if (lastTranscript) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        postMessage({
          type: 'transcript',
          text: lastTranscript,
          confidence: event.results[event.results.length - 1][0].confidence,
        });
        lastTranscript = '';
      }, 300); // 300ms debounce
    }
  };

  recognition.onerror = (event) => {
    console.error('[Worker] Recognition error:', event.error);
    postMessage({
      type: 'error',
      error: event.error,
      message: getErrorMessage(event.error),
    });
  };

  recognition.onend = () => {
    console.log('[Worker] Recognition ended');
    postMessage({ type: 'status', status: 'stopped' });
    isListening = false;
  };
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
  const messages = {
    'no-speech': 'No speech detected. Please try again.',
    'audio-capture': 'No microphone found. Please check permissions.',
    'not-allowed': 'Microphone access denied. Please allow permissions in browser settings.',
    'network': 'Network error. Please check your connection.',
    'aborted': 'Voice listening was stopped.',
  };
  return messages[error] || `Voice error: ${error}`;
}

/**
 * Start listening for voice commands
 */
function startListening() {
  if (isListening) return;

  initRecognition();
  isListening = true;

  try {
    recognition.start();
  } catch (error) {
    console.error('[Worker] Error starting recognition:', error);
    postMessage({
      type: 'error',
      message: 'Failed to start voice listening',
    });
  }
}

/**
 * Stop listening
 */
function stopListening() {
  if (!isListening || !recognition) return;

  isListening = false;
  clearTimeout(debounceTimer);
  lastTranscript = '';

  try {
    recognition.stop();
  } catch (error) {
    console.error('[Worker] Error stopping recognition:', error);
  }
}

/**
 * Handle messages from main thread
 */
self.onmessage = (event) => {
  const { type } = event.data;

  switch (type) {
    case 'start':
      console.log('[Worker] Received start command');
      startListening();
      break;

    case 'stop':
      console.log('[Worker] Received stop command');
      stopListening();
      break;

    case 'check-status':
      postMessage({
        type: 'status',
        status: isListening ? 'listening' : 'stopped',
      });
      break;

    default:
      console.warn('[Worker] Unknown message type:', type);
  }
};

console.log('[Worker] Voice Worker initialized');
