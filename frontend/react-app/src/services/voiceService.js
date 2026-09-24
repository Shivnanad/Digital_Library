// Voice Service — calls backend to process commands via Ollama AI
import { OLLAMA_CONFIG } from '../config/voiceConfig';

const API_BASE = 'http://localhost:5000/api';

/**
 * Send transcript (and optional history) to backend for AI processing
 * Accepts either a transcript string or { transcript, history }
 * Returns: { success, data: { intent, query, bookTitle, action, response, emotion } }
 */
export const processVoiceCommand = async (input) => {
  const payload = typeof input === 'string' ? { transcript: input } : { ...(input || {}) };
  payload.transcript = (payload.transcript || '').trim();

  if (!payload.transcript) throw new Error('Empty transcript');

  if (Array.isArray(payload.history)) {
    payload.history = payload.history.slice(-8);
  } else {
    delete payload.history;
  }

  const token = localStorage.getItem('token');

  // Try up to RETRY_LIMIT times
  let lastError;
  for (let attempt = 1; attempt <= OLLAMA_CONFIG.RETRY_LIMIT; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/voice/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(OLLAMA_CONFIG.TIMEOUT),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err) {
      lastError = err;
      if (attempt < OLLAMA_CONFIG.RETRY_LIMIT) {
        await new Promise(r => setTimeout(r, OLLAMA_CONFIG.RETRY_DELAY * attempt));
      }
    }
  }

  throw lastError;
};

/**
 * Check if Ollama is available
 */
export const checkOllamaStatus = async () => {
  try {
    const res = await fetch(`${OLLAMA_CONFIG.BASE_URL}/api/tags`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
};
