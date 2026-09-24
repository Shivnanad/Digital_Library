const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_API_URL || 'http://localhost:11434';
const MODEL = 'gemma4:latest'; // Using the locally installed model

// Helper to call Ollama API
const callOllama = async (prompt, maxTokens = 1000) => {
  try {
    if (!OLLAMA_URL || OLLAMA_URL === '') {
      throw new Error('OLLAMA_API_URL is not set in environment variables');
    }

    console.log(`Calling Ollama at ${OLLAMA_URL} with model ${MODEL}`);

    const response = await axios.post(`${OLLAMA_URL}/v1/chat/completions`, {
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: maxTokens,
      stream: false
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 90000 // 90 seconds for Ollama (may be slow on first request)
    });

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    }
    throw new Error('No response from Ollama');
  } catch (error) {
    console.error('Ollama Error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      url: OLLAMA_URL
    });
    
    if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to Ollama. Make sure Ollama is running at ' + OLLAMA_URL);
    }
    throw new Error('AI service error: ' + error.message);
  }
};

// 1. AI Chatbot - Ask questions about the book
exports.chatWithAI = async (req, res) => {
  try {
    const { question, bookTitle, bookAuthor, context } = req.body;

    const prompt = `You are a helpful book reading assistant for "${bookTitle}" by ${bookAuthor}. 
    Current page context: "${context.substring(0, 500)}"
    
    User question: "${question}"
    
    Provide a helpful answer based on the book's context. Keep it concise (2-3 sentences).`;

    const response = await callOllama(prompt, 500);
    res.json({ success: true, response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Summarization - Summarize page/chapter
exports.summarizeContent = async (req, res) => {
  try {
    const { text, bookTitle } = req.body;

    const prompt = `Summarize the following text from "${bookTitle}" in 3-4 bullet points. Keep it concise:
    
    "${text.substring(0, 1000)}"
    
    Format as bullet points starting with -.`;

    const response = await callOllama(prompt, 200); // Reduced for faster response
    res.json({ success: true, summary: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 3. Extract Key Highlights - AI-powered important phrases
exports.extractHighlights = async (req, res) => {
  try {
    const { text, bookTitle } = req.body;

    const prompt = `From the following text of "${bookTitle}", extract 5-7 most important sentences or phrases. Format as a list with line breaks:
    
    Text: "${text.substring(0, 800)}"
    
    Return ONLY the important quotes/phrases, one per line, without numbering.`;

    const response = await callOllama(prompt, 250); // Reduced for faster response
    const highlights = response.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5);
    
    res.json({ success: true, highlights });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Word Translator - Translate difficult words
exports.translateWord = async (req, res) => {
  try {
    const { word, context } = req.body;

    const prompt = `Define and explain the word "${word}" in simple terms. Context: "${context}"
    
    Provide:
    1. Definition (1 sentence)
    2. Simple explanation (1-2 sentences)
    3. Example in context
    
    Keep it user-friendly.`;

    const response = await callOllama(prompt, 200); // Reduced for faster response
    res.json({ success: true, definition: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 5. Book Q&amp;A - Reading comprehension questions
exports.generateQuestions = async (req, res) => {
  try {
    const { text, bookTitle } = req.body;

    const prompt = `Based on the following text from "${bookTitle}", generate 3 reading comprehension questions and answers (for self-testing):
    
    Text: "${text.substring(0, 800)}"
    
    Format your response as:
    Q1: [question]
    A1: [answer]
    
    Q2: [question]
    A2: [answer]
    
    Q3: [question]
    A3: [answer]`;

    const response = await callOllama(prompt, 300); // Reduced for faster response
    
    // Parse response into Q&A pairs
    const lines = response.split('\n').filter(line => line.trim());
    const questions = [];
    
    for (let i = 0; i < lines.length; i += 2) {
      if (lines[i]?.startsWith('Q') && lines[i + 1]?.startsWith('A')) {
        questions.push({
          question: lines[i].replace(/^Q\d+:\s*/, '').trim(),
          answer: lines[i + 1].replace(/^A\d+:\s*/, '').trim()
        });
      }
    }
    
    res.json({ success: true, questions: questions.length > 0 ? questions : [] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 6. Theme Analysis - Analyze book themes
exports.analyzeTheme = async (req, res) => {
  try {
    const { text, bookTitle, bookAuthor } = req.body;

    const prompt = `Analyze the themes and literary elements in this passage from "${bookTitle}" by ${bookAuthor}:
    
    "${text.substring(0, 800)}"
    
    Cover:
    1. Main theme (1 sentence)
    2. Literary devices used (tone, imagery, etc.)
    3. Connection to larger story (if applicable)
    
    Keep it educational but accessible.`;

    const response = await callOllama(prompt, 300); // Reduced for faster response
    res.json({ success: true, analysis: response });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
