import { useState, useEffect } from 'react';
import {
  chatWithAI,
  summarizeText,
  extractHighlights,
  translateWord,
  generateQuestions,
  analyzeTheme
} from '../services/aiService';
import '../styles/aiSidebar.css';

export default function AISidebar({ selectedText, pageContent, bookTitle, bookAuthor, embedded = false }) {
  const [activeTab, setActiveTab] = useState('chat');
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  // Chat state
  const [question, setQuestion] = useState('');

  // Word state
  const [word, setWord] = useState('');

  // Custom content state - allow users to paste text from PDF
  const [customContent, setCustomContent] = useState('');

  // Questions state
  const [questionsData, setQuestionsData] = useState([]);
  const [showAnswers, setShowAnswers] = useState({});

  // Use custom content if provided, otherwise use page content
  const getContent = () => {
    if (customContent.trim()) return customContent;
    if (pageContent) return pageContent;
    return '';
  };

  const handleChat = async () => {
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await chatWithAI(question, bookTitle, bookAuthor, pageContent);
      setResult(response);
      setQuestion('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    const content = getContent();
    if (!content) {
      setError('No content available. Paste text from the PDF above.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const summary = await summarizeText(content, bookTitle);
      setResult(summary);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleHighlights = async () => {
    const content = getContent();
    if (!content) {
      setError('No content available. Paste text from the PDF above.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const highlights = await extractHighlights(content, bookTitle);
      setResult(Array.isArray(highlights) ? highlights.join('\n\n') : highlights);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!word.trim()) {
      setError('Please enter a word to define');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const content = getContent();
      const definition = await translateWord(word, content || '');
      setResult(definition);
      setWord('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleQuestions = async () => {
    const content = getContent();
    if (!content) {
      setError('No content available. Paste text from the PDF above.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const questions = await generateQuestions(content, bookTitle);
      setQuestionsData(questions || []);
      setResult('Questions generated!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTheme = async () => {
    const content = getContent();
    if (!content) {
      setError('No content available. Paste text from the PDF above.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const analysis = await analyzeTheme(content, bookTitle, bookAuthor);
      setResult(analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      /* Use user's saved voice preference */
      const savedName = localStorage.getItem("readify_voice");
      if (savedName) {
        const match = speechSynthesis.getVoices().find(v => v.name === savedName);
        if (match) utterance.voice = match;
      }
      utterance.rate = 1;
      speechSynthesis.speak(utterance);
    }
  };

  // Compose the inner content once so we can render it embedded or as a sidebar
  const inner = (
    <div className="ai-inner">
      <div className="ai-header">
        <h3>
          <i className="fas fa-robot"></i> AI Assistant
        </h3>
        {!embedded && (
          <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
            <i className="fas fa-times"></i>
          </button>
        )}
      </div>

      {/* Content Input Area */}
      <div className="ai-content-input-wrapper">
        <textarea
          className="ai-content-input"
          placeholder="Paste text from PDF here (or use auto-loaded content)..."
          value={customContent}
          onChange={(e) => setCustomContent(e.target.value)}
          title="Paste content from the PDF for summarization and analysis"
        />
        {customContent && (
          <button
            className="ai-clear-btn"
            onClick={() => setCustomContent('')}
            title="Clear content"
          >
            <i className="fas fa-trash"></i>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="ai-tabs">
        <button className={`ai-tab ${activeTab === 'chat' ? 'active' : ''}`} onClick={() => setActiveTab('chat')} title="Chat with AI">
          <i className="fas fa-comments"></i> Chat
        </button>
        <button className={`ai-tab ${activeTab === 'summarize' ? 'active' : ''}`} onClick={() => setActiveTab('summarize')} title="Summarize page">
          <i className="fas fa-compress"></i> Summary
        </button>
        <button className={`ai-tab ${activeTab === 'highlights' ? 'active' : ''}`} onClick={() => setActiveTab('highlights')} title="Extract highlights">
          <i className="fas fa-highlighter"></i> Highlights
        </button>
        <button className={`ai-tab ${activeTab === 'translate' ? 'active' : ''}`} onClick={() => setActiveTab('translate')} title="Define words">
          <i className="fas fa-language"></i> Words
        </button>
        <button className={`ai-tab ${activeTab === 'questions' ? 'active' : ''}`} onClick={() => setActiveTab('questions')} title="Reading questions">
          <i className="fas fa-question-circle"></i> Q&A
        </button>
        <button className={`ai-tab ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => setActiveTab('theme')} title="Analyze themes">
          <i className="fas fa-book"></i> Themes
        </button>
      </div>

      {/* Content */}
      <div className="ai-content">
        {error && (
          <div className="ai-error">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="ai-panel">
            <p className="ai-hint">Ask questions about the book</p>
            <textarea
              className="ai-input"
              placeholder="Ask anything about this book..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleChat()}
            />
            <button className="ai-btn" onClick={handleChat} disabled={loading}>
              {loading ? <span className="ai-spinner" /> : <i className="fas fa-paper-plane"></i>}
              {loading ? 'Thinking...' : 'Ask'}
            </button>
          </div>
        )}

        {/* Summarize Tab */}
        {activeTab === 'summarize' && (
          <div className="ai-panel">
            <p className="ai-hint">Get a quick summary of this page</p>
            <button className="ai-btn ai-btn-full" onClick={handleSummarize} disabled={loading}>
              {loading ? <span className="ai-spinner" /> : <i className="fas fa-compress"></i>}
              {loading ? 'Summarizing...' : 'Summarize This Page'}
            </button>
          </div>
        )}

        {/* Highlights Tab */}
        {activeTab === 'highlights' && (
          <div className="ai-panel">
            <p className="ai-hint">Find important quotes and ideas</p>
            <button className="ai-btn ai-btn-full" onClick={handleHighlights} disabled={loading}>
              {loading ? <span className="ai-spinner" /> : <i className="fas fa-highlighter"></i>}
              {loading ? 'Extracting...' : 'Extract Highlights'}
            </button>
          </div>
        )}

        {/* Translate Tab */}
        {activeTab === 'translate' && (
          <div className="ai-panel">
            <p className="ai-hint">Define difficult words</p>
            <input type="text" className="ai-input" placeholder="Enter a word to define..." value={word} onChange={(e) => setWord(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleTranslate()} />
            <button className="ai-btn" onClick={handleTranslate} disabled={loading}>{loading ? <span className="ai-spinner" /> : <i className="fas fa-book"></i>}{loading ? 'Defining...' : 'Define'}</button>
          </div>
        )}

        {/* Questions Tab */}
        {activeTab === 'questions' && (
          <div className="ai-panel">
            <p className="ai-hint">Test your understanding</p>
            <button className="ai-btn ai-btn-full" onClick={handleQuestions} disabled={loading}>{loading ? <span className="ai-spinner" /> : <i className="fas fa-question-circle"></i>}{loading ? 'Generating...' : 'Generate Questions'}</button>
          </div>
        )}

        {/* Theme Tab */}
        {activeTab === 'theme' && (
          <div className="ai-panel">
            <p className="ai-hint">Analyze themes and literary style</p>
            <button className="ai-btn ai-btn-full" onClick={handleTheme} disabled={loading}>{loading ? <span className="ai-spinner" /> : <i className="fas fa-book"></i>}{loading ? 'Analyzing...' : 'Analyze This Page'}</button>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="ai-result">
            {activeTab === 'questions' && questionsData.length > 0 ? (
              <div className="ai-questions-list">
                {questionsData.map((q, idx) => (
                  <div key={idx} className="ai-question-item">
                    <button className="ai-question-toggle" onClick={() => setShowAnswers({ ...showAnswers, [idx]: !showAnswers[idx] })}>
                      <i className={`fas fa-chevron-${showAnswers[idx] ? 'up' : 'down'}`}></i>
                      <strong>Q{idx + 1}:</strong> {q.question}
                    </button>
                    {showAnswers[idx] && (
                      <div className="ai-answer">
                        <p>{q.answer}</p>
                        <button className="ai-speak-btn" onClick={() => speakText(q.answer)} title="Read aloud"><i className="fas fa-volume-up"></i></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ai-result-text">
                <p>{result}</p>
                <button className="ai-speak-btn" onClick={() => speakText(result)} title="Read aloud"><i className="fas fa-volume-up"></i> Read Aloud</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (embedded) {
    return <div className="ai-embedded">{inner}</div>;
  }

  return (
    <>
      {/* Toggle Button */}
      <button className="ai-toggle-btn" onClick={() => setIsOpen(!isOpen)} title="Toggle AI Assistant" aria-label="AI Assistant">
        <i className="fas fa-sparkles"></i>
      </button>

      {/* AI Sidebar */}
      <div className={`ai-sidebar ${isOpen ? 'open' : ''}`}>
        {inner}
      </div>
    </>
  );
}
