const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'neural-chat';

const ALLOWED_INTENTS = new Set([
  'search',
  'open_book',
  'add_to_cart',
  'add_to_wishlist',
  'navigate',
  'help',
  'unknown',
]);

const ALLOWED_EMOTIONS = new Set([
  'friendly',
  'calm',
  'excited',
  'empathetic',
  'neutral',
]);

function cleanText(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLen);
}

function normalizeIntent(value) {
  const normalized = cleanText(value, 40).toLowerCase().replace(/\s+/g, '_');
  if (!ALLOWED_INTENTS.has(normalized)) return 'unknown';
  return normalized;
}

function normalizeEmotion(value) {
  const normalized = cleanText(value, 30).toLowerCase();
  if (!ALLOWED_EMOTIONS.has(normalized)) return 'friendly';
  return normalized;
}

function extractJsonObject(text) {
  if (typeof text !== 'string') return null;
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first < 0 || last < 0 || last <= first) return null;
  return text.slice(first, last + 1);
}

function isLikelyControlCommand(transcript) {
  const clean = cleanText(transcript, 220).toLowerCase();
  if (!clean) return false;

  const controlPatterns = [
    /^(help|stop|cancel|bye|goodbye|go to sleep|sleep|never mind|nevermind)$/i,
    /\b(add to cart|add this to cart|add to wishlist|save this|favorite)\b/i,
    /\b(dark mode|light mode|toggle theme|switch theme)\b/i,
    /\b(what(?:'s|s| is)?\s*(?:your|ur)\s*(?:name|same)|tell me\s*(?:your|ur)\s*(?:name|same)|who\s*(?:are|r)\s*you|introduce yourself)\b/i,
  ];

  return controlPatterns.some((pattern) => pattern.test(clean));
}

function fallbackAction(intent, query, bookTitle) {
  switch (intent) {
    case 'search':
      return query ? `Search for ${query}` : 'Search books';
    case 'open_book':
      return bookTitle ? `Open ${bookTitle}` : 'Open requested book';
    case 'navigate':
      return query ? `Navigate to ${query}` : 'Navigate to requested page';
    case 'add_to_cart':
      return 'Add current book to cart';
    case 'add_to_wishlist':
      return 'Add current book to wishlist';
    case 'help':
      return 'Show help information';
    default:
      return 'Handle the user request';
  }
}

function fallbackResponse(intent, query, bookTitle) {
  switch (intent) {
    case 'search':
      return query ? `Sure, I will search for ${query}.` : 'Sure, I will search that for you.';
    case 'open_book':
      return bookTitle ? `Okay, looking for ${bookTitle} now.` : 'Okay, I will open that book for you.';
    case 'navigate':
      return query ? `Okay, taking you to ${query}.` : 'Okay, navigating now.';
    case 'add_to_cart':
      return 'Okay, I can help add this to your cart.';
    case 'add_to_wishlist':
      return 'Okay, I can add this to your wishlist.';
    case 'help':
      return 'I can search books, open books, and help with navigation.';
    default:
      return 'I can help with that.';
  }
}

/**
 * Process voice command using Ollama
 */
const processVoiceCommand = async (req, res) => {
  try {
    const transcript = cleanText(req.body && req.body.transcript, 280);
    const history = req.body && req.body.history;
    console.log('[voiceController] Received transcript:', transcript);

    if (!transcript) {
      console.warn('[voiceController] Empty transcript');
      return res.status(400).json({
        success: false,
        message: 'Empty transcript',
      });
    }

    const historyLines = Array.isArray(history)
      ? history
          .slice(-6)
          .map((item, index) => {
            const roleRaw = item && typeof item.role === 'string' ? item.role : 'user';
            const role = roleRaw.toLowerCase() === 'assistant' ? 'assistant' : 'user';
            const contentRaw =
              item && typeof item.content === 'string'
                ? item.content
                : item && typeof item.text === 'string'
                  ? item.text
                  : '';
            const content = cleanText(contentRaw, 180);
            if (!content) return null;
            return `${index + 1}. ${role}: ${content}`;
          })
          .filter(Boolean)
      : [];

    const historyBlock = historyLines.length > 0
      ? historyLines.join('\n')
      : 'No previous conversation.';

    const prompt = `You are Readify Voice Assistant.

Current user utterance: "${transcript}"

Recent conversation:
${historyBlock}

Analyze the user utterance and respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "intent": "search|open_book|add_to_cart|add_to_wishlist|navigate|help|unknown",
  "query": "search query if applicable",
  "bookTitle": "book title if user mentioned it",
  "action": "brief machine action summary",
  "response": "natural spoken reply in 1-2 short sentences",
  "emotion": "friendly|calm|excited|empathetic|neutral"
}

Rules:
- If this is not a clear system command, default to intent "search".
- If user asks your name/identity (for example "what is your name" or "who are you"), use intent "help".
- Keep "response" conversational and warm.
- "query" should be concise and useful for search.
- Output strict JSON only.`;

    console.log('[voiceController] Calling Ollama at:', OLLAMA_BASE_URL);
    console.log('[voiceController] Using model:', OLLAMA_MODEL);

    // Call Ollama API
    const ollamaResponse = await axios.post(
      `${OLLAMA_BASE_URL}/api/generate`,
      {
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      },
      {
        timeout: 15000,
      }
    );

    // Parse Ollama response
    const responseText = ollamaResponse.data.response || '';
    console.log('[voiceController] Ollama raw response:', responseText.substring(0, 200));
    
    let commandData;

    try {
      const jsonText = extractJsonObject(responseText);
      if (!jsonText) {
        console.warn('[voiceController] No JSON found in response');
        throw new Error('No JSON found in response');
      }
      commandData = JSON.parse(jsonText);
      console.log('[voiceController] Parsed command:', commandData);
    } catch (parseError) {
      console.error('[voiceController] Error parsing Ollama response:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Failed to process voice command',
        error: 'Could not parse response from AI',
      });
    }

    let intent = normalizeIntent(commandData.intent);
    let query = cleanText(commandData.query, 140);
    let bookTitle = cleanText(commandData.bookTitle, 140);
    let action = cleanText(commandData.action, 180);
    let response = cleanText(commandData.response, 260);
    const emotion = normalizeEmotion(commandData.emotion);

    if (intent === 'search' && !query) {
      query = transcript;
    }

    if (intent === 'open_book' && !bookTitle && query) {
      bookTitle = query;
    }

    if (intent === 'unknown' && !isLikelyControlCommand(transcript)) {
      intent = 'search';
      if (!query) query = transcript;
    }

    if (!action) {
      action = fallbackAction(intent, query, bookTitle);
    }

    if (!response) {
      response = fallbackResponse(intent, query, bookTitle);
    }

    // Return processed command
    return res.status(200).json({
      success: true,
      message: 'Command processed',
      data: {
        intent,
        query,
        bookTitle,
        action,
        response,
        emotion,
        originalTranscript: transcript,
      },
    });
  } catch (error) {
    console.error('[voiceController] Error:', error.message);
    console.error('[voiceController] Error code:', error.code);

    // Handle Ollama connection errors
    if (error.code === 'ECONNREFUSED') {
      console.error('[voiceController] Ollama not running');
      return res.status(503).json({
        success: false,
        message: 'AI service unavailable',
        error: `Ollama is not running at ${OLLAMA_BASE_URL}. Start with: ollama serve`,
      });
    }

    if (error.code === 'ENOTFOUND' || error.code === 'EHOSTUNREACH') {
      console.error('[voiceController] Ollama not found');
      return res.status(503).json({
        success: false,
        message: 'AI service not found',
        error: `Cannot reach Ollama at ${OLLAMA_BASE_URL}`,
      });
    }

    if (error.code === 'ECONNABORTED' || (typeof error.message === 'string' && error.message.toLowerCase().includes('timeout'))) {
      console.error('[voiceController] Timeout or connection refused');
      return res.status(503).json({
        success: false,
        message: 'AI service timeout',
        error: 'Ollama is taking too long to respond',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to process voice command',
      error: error.message,
    });
  }
};

/**
 * Check Ollama service status
 */
const checkOllamaStatus = async (req, res) => {
  try {
    console.log('[voiceController] Checking Ollama status...');
    const response = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, {
      timeout: 2000,
    });

    console.log('[voiceController] Ollama is running');
    return res.status(200).json({
      success: true,
      available: true,
      models: response.data.models || [],
    });
  } catch (error) {
    console.warn('[voiceController] Ollama check failed:', error.message);
    return res.status(200).json({
      success: true,
      available: false,
      error: 'Ollama service is not running',
    });
  }
};

/**
 * Execute voice-based navigation
 */
const executeVoiceNavigation = async (req, res) => {
  try {
    const { intent, query, bookTitle } = req.body;
    console.log('[voiceController] Executing navigation for intent:', intent);

    const navigationMap = {
      search: {
        redirect: `/search?query=${encodeURIComponent(query)}`,
        message: `Searching for ${query}...`,
      },
      open_book: {
        action: 'search_and_open',
        params: { bookTitle },
        message: `Looking for ${bookTitle}...`,
      },
      add_to_cart: {
        action: 'add_to_cart',
        message: 'Adding to cart...',
      },
      add_to_wishlist: {
        action: 'add_to_wishlist',
        message: 'Adding to wishlist...',
      },
      help: {
        message: 'I can help you search for books, add them to cart, or navigate the library.',
      },
      unknown: {
        message: 'Sorry, I did not understand that. Try saying "Show me fantasy books" or "Add to cart".',
      },
    };

    const action = navigationMap[intent] || navigationMap.unknown;

    return res.status(200).json({
      success: true,
      data: action,
    });
  } catch (error) {
    console.error('[voiceController] Navigation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to execute navigation',
      error: error.message,
    });
  }
};

module.exports = {
  processVoiceCommand,
  checkOllamaStatus,
  executeVoiceNavigation,
};
