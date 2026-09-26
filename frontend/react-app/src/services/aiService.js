import axios from 'axios';
import { API_BASE as CONFIG_API_BASE } from '../config/api.js';

const API_BASE = `${CONFIG_API_BASE}/ai`;

// Chat with AI about the book
export const chatWithAI = async (question, bookTitle, bookAuthor, context) => {
  try {
    const response = await axios.post(`${API_BASE}/chat`, {
      question,
      bookTitle,
      bookAuthor,
      context
    }, {
      timeout: 60000 // 60 seconds for Ollama
    });
    return response.data.response;
  } catch (error) {
    console.error('Chat error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error(error.response?.data?.message || 'Failed to get AI response. Please try again.');
  }
};

// Summarize current page/chapter
export const summarizeText = async (text, bookTitle) => {
  try {
    const response = await axios.post(`${API_BASE}/summarize`, {
      text,
      bookTitle
    }, {
      timeout: 60000 // 60 seconds for Ollama to respond
    });
    return response.data.summary;
  } catch (error) {
    console.error('Summarize error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Ollama is taking too long. Please try again.');
    }
    throw new Error(error.response?.data?.message || 'Failed to summarize. Please try again.');
  }
};

// Extract important highlights from text
export const extractHighlights = async (text, bookTitle) => {
  try {
    const response = await axios.post(`${API_BASE}/highlights`, {
      text,
      bookTitle
    }, {
      timeout: 60000 // 60 seconds for Ollama
    });
    return response.data.highlights;
  } catch (error) {
    console.error('Highlights error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error(error.response?.data?.message || 'Failed to extract highlights. Please try again.');
  }
};

// Translate/define a difficult word
export const translateWord = async (word, context) => {
  try {
    const response = await axios.post(`${API_BASE}/translate`, {
      word,
      context
    }, {
      timeout: 60000 // 60 seconds for Ollama
    });
    return response.data.definition;
  } catch (error) {
    console.error('Translate error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error(error.response?.data?.message || 'Failed to define word. Please try again.');
  }
};

// Generate reading comprehension questions
export const generateQuestions = async (text, bookTitle) => {
  try {
    const response = await axios.post(`${API_BASE}/questions`, {
      text,
      bookTitle
    }, {
      timeout: 60000 // 60 seconds for Ollama
    });
    return response.data.questions;
  } catch (error) {
    console.error('Questions error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error(error.response?.data?.message || 'Failed to generate questions. Please try again.');
  }
};

// Analyze themes and literary elements
export const analyzeTheme = async (text, bookTitle, bookAuthor) => {
  try {
    const response = await axios.post(`${API_BASE}/analyze-theme`, {
      text,
      bookTitle,
      bookAuthor
    }, {
      timeout: 60000 // 60 seconds for Ollama
    });
    return response.data.analysis;
  } catch (error) {
    console.error('Analysis error:', error);
    if (error.code === 'ECONNABORTED') {
      throw new Error('Request timed out. Please try again.');
    }
    throw new Error(error.response?.data?.message || 'Failed to analyze theme. Please try again.');
  }
};
