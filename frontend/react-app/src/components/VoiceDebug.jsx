import React from 'react';
import { useVoice } from '../context/VoiceContext';
import '../styles/voiceDebug.css';

export default function VoiceDebug() {
  const { isListening, isCommandMode, isEnabled, status, transcript, interimTranscript, error } = useVoice();

  return (
    <div className="voice-debug">
      <div className="debug-header">🔧 Voice Debug</div>
      
      <div className="debug-row">
        <span className="debug-label">Enabled:</span>
        <span className={`debug-value ${isEnabled ? 'active' : 'inactive'}`}>
          {isEnabled ? '✓ YES' : '✗ NO'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-label">Listening:</span>
        <span className={`debug-value ${isListening ? 'active' : 'inactive'}`}>
          {isListening ? '✓ YES' : '✗ NO'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-label">Command Mode:</span>
        <span className={`debug-value ${isCommandMode ? 'active' : 'inactive'}`}>
          {isCommandMode ? '✓ YES' : '✗ NO'}
        </span>
      </div>

      <div className="debug-row">
        <span className="debug-label">Status:</span>
        <span className="debug-value">{status}</span>
      </div>

      {transcript && (
        <div className="debug-row">
          <span className="debug-label">Transcript:</span>
          <span className="debug-value">{transcript}</span>
        </div>
      )}

      {interimTranscript && (
        <div className="debug-row">
          <span className="debug-label">Interim:</span>
          <span className="debug-value" style={{ opacity: 0.7 }}>{interimTranscript}</span>
        </div>
      )}

      {error && (
        <div className="debug-row error">
          <span className="debug-label">Error:</span>
          <span className="debug-value">{error}</span>
        </div>
      )}
    </div>
  );
}
