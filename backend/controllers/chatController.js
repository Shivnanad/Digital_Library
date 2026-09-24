const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const MODEL = 'gemma4:latest';

// Call Ollama API for real AI responses
const callOllama = async (messages, bookTitle) => {
  try {
    if (!OLLAMA_URL || OLLAMA_URL === '') {
      throw new Error('OLLAMA_API_URL is not set');
    }

    // Build system prompt
    const systemPrompt = `You are a helpful and knowledgeable reading assistant for the book "${bookTitle}". 
Answer questions about the book content clearly and concisely. If asked about something not in the book, be honest about that limitation.
Keep responses focused, friendly, and educational.`;

    // Format messages for Ollama
    const formattedMessages = [
      {
        role: 'system',
        content: systemPrompt
      },
      ...messages
    ];

    const response = await axios.post(`${OLLAMA_URL}/v1/chat/completions`, {
      model: MODEL,
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 500, // Reduced for faster response
      stream: false
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    throw new Error('No response from Ollama');
  } catch (error) {
    console.error('Ollama Error:', error.message);
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running at ' + OLLAMA_URL);
    }
    throw error;
  }
};

// Chat endpoint - now uses real Ollama AI
exports.chat = async (req, res) => {
  try {
    const { messages = [], bookTitle = "this book" } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ message: "messages array is required" });
    }

    // Call Ollama with conversation history
    const reply = await callOllama(messages, bookTitle);
    return res.json({ reply });

  } catch (err) {
    console.error("Chat error:", err);
    res.status(500).json({ 
      message: "Chat service error", 
      error: err.message 
    });
  }
};
