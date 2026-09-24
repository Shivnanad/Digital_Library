import React, { useState, useEffect } from 'react';
import { 
  getBrowserInfo, 
  checkVoiceSupport, 
  requestMicrophonePermission,
  testMicrophone 
} from '../config/browserCompatibility';

/**
 * VoiceDebugPanel - Debug tool for microphone and voice testing
 * Shows browser info, microphone status, and allows testing
 */
export default function VoiceDebugPanel() {
  const [browserInfo, setBrowserInfo] = useState(null);
  const [voiceSupport, setVoiceSupport] = useState(null);
  const [micPermission, setMicPermission] = useState(null);
  const [micTest, setMicTest] = useState(null);
  const [isLoading, setIsLoading] = useState({});

  useEffect(() => {
    // Get browser info on mount
    const info = getBrowserInfo();
    setBrowserInfo(info);
    
    // Check voice support
    const support = checkVoiceSupport();
    setVoiceSupport(support);
  }, []);

  const handleRequestPermission = async () => {
    setIsLoading(prev => ({ ...prev, permission: true }));
    try {
      const result = await requestMicrophonePermission();
      setMicPermission(result);
    } catch (error) {
      setMicPermission({ success: false, error: error.message });
    }
    setIsLoading(prev => ({ ...prev, permission: false }));
  };

  const handleTestMicrophone = async () => {
    setIsLoading(prev => ({ ...prev, test: true }));
    try {
      const result = await testMicrophone();
      setMicTest(result);
    } catch (error) {
      setMicTest({ isWorking: false, error: error.message });
    }
    setIsLoading(prev => ({ ...prev, test: false }));
  };

  const userAgentStyle = {
    ...styles.value,
    fontSize: '12px',
    wordBreak: 'break-all'
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🔧 Voice Debug Panel</h2>
      
      {/* Browser Info */}
      {browserInfo && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📱 Browser Info</h3>
          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <span style={styles.label}>Browser:</span>
              <span style={styles.value}>{browserInfo.browserName} {browserInfo.browserVersion}</span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.label}>User Agent:</span>
              <span style={userAgentStyle}>
                {browserInfo.ua.substring(0, 80)}...
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Voice Support */}
      {voiceSupport && (
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>🎤 Voice Support</h3>
          <div style={styles.infoList}>
            <div style={styles.infoItem}>
              <span style={styles.label}>Speech Recognition:</span>
              <span style={{
                ...styles.value,
                color: voiceSupport.isSupported ? '#22c55e' : '#ef4444'
              }}>
                {voiceSupport.isSupported ? '✓ Supported' : '✗ Not Supported'}
              </span>
            </div>
            <div style={styles.infoItem}>
              <span style={styles.label}>Media Devices:</span>
              <span style={{
                ...styles.value,
                color: voiceSupport.hasMediaDevices ? '#22c55e' : '#ef4444'
              }}>
                {voiceSupport.hasMediaDevices ? '✓ Available' : '✗ Not Available'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Permission Status */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🔐 Microphone Permission</h3>
        <button 
          onClick={handleRequestPermission}
          disabled={isLoading.permission}
          style={{
            ...styles.button,
            opacity: isLoading.permission ? 0.6 : 1
          }}
        >
          {isLoading.permission ? '⏳ Requesting...' : '🔍 Request Permission'}
        </button>
        {micPermission && (
          <div style={{
            ...styles.result,
            backgroundColor: micPermission.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: micPermission.success ? '#22c55e' : '#ef4444'
          }}>
            <span style={{ color: micPermission.success ? '#22c55e' : '#ef4444' }}>
              {micPermission.success ? '✓' : '✗'}
            </span>
            {' '}
            {micPermission.success 
              ? 'Microphone permission granted' 
              : micPermission.error}
          </div>
        )}
      </div>

      {/* Microphone Test */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🎵 Microphone Audio Level</h3>
        <button 
          onClick={handleTestMicrophone}
          disabled={isLoading.test}
          style={{
            ...styles.button,
            opacity: isLoading.test ? 0.6 : 1
          }}
        >
          {isLoading.test ? '⏳ Testing...' : '📊 Test Microphone'}
        </button>
        {micTest && (
          <div style={{
            ...styles.result,
            backgroundColor: micTest.isWorking ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            borderColor: micTest.isWorking ? '#3b82f6' : '#ef4444'
          }}>
            <div>
              <strong>{micTest.isWorking ? '✓ Microphone Working' : '✗ No Audio Detected'}</strong>
            </div>
            <div style={{ fontSize: '14px', marginTop: '4px' }}>
              Audio Level: <strong>{micTest.audioLevel}</strong>
              {micTest.audioLevel > 30 && ' (Good)'}
              {micTest.audioLevel > 10 && micTest.audioLevel <= 30 && ' (Fair - speak louder)'}
              {micTest.audioLevel <= 10 && ' (Low - check microphone)'}
            </div>
            {micTest.error && (
              <div style={{ fontSize: '12px', marginTop: '4px', color: '#ef4444' }}>
                Error: {micTest.error}
              </div>
            )}
          </div>
        )}

        {/* Audio Level Visual Indicator */}
        {micTest && micTest.audioLevel !== undefined && (
          <div style={{ marginTop: '12px' }}>
            <div style={styles.audioBar}>
              <div 
                style={{
                  ...styles.audioBarFill,
                  width: `${Math.min((micTest.audioLevel / 255) * 100, 100)}%`,
                  backgroundColor: 
                    micTest.audioLevel > 50 ? '#22c55e' :
                    micTest.audioLevel > 20 ? '#eab308' :
                    '#ef4444'
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Troubleshooting Tips */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>💡 Troubleshooting Tips</h3>
        <ul style={styles.tipsList}>
          <li>If permission is blocked, check browser settings</li>
          <li>Firefox: go to about:preferences#privacy → Microphone</li>
          <li>Chrome: Settings → Privacy → Microphone</li>
          <li>If audio level is low, check microphone volume</li>
          <li>Speak clearly and close to the microphone</li>
          <li>Make sure no other app is using the microphone</li>
          <li>Test microphone in system settings first</li>
        </ul>
      </div>

      <div style={styles.footer}>
        Check DevTools Console (F12) for detailed voice logs
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    backgroundColor: 'rgba(20, 25, 50, 0.8)',
    borderRadius: '8px',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    color: '#f0f0f0',
    maxWidth: '500px',
    margin: '20px 0',
  },
  title: {
    margin: '0 0 16px 0',
    color: '#f59e0b',
    fontSize: '20px',
  },
  section: {
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '1px solid rgba(100, 100, 100, 0.2)',
  },
  sectionTitle: {
    marginTop: 0,
    marginBottom: '10px',
    fontSize: '16px',
    color: '#fbbf24',
  },
  infoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  infoItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
  },
  label: {
    fontWeight: 'bold',
    color: '#d0d0d0',
  },
  value: {
    color: '#a0a0a0',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#f59e0b',
    border: 'none',
    borderRadius: '4px',
    color: '#000',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s',
  },
  result: {
    marginTop: '12px',
    padding: '10px',
    borderRadius: '4px',
    border: '1px solid',
    fontSize: '13px',
  },
  audioBar: {
    width: '100%',
    height: '20px',
    backgroundColor: 'rgba(100, 100, 100, 0.2)',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid rgba(100, 100, 100, 0.4)',
  },
  audioBarFill: {
    height: '100%',
    transition: 'width 0.1s ease',
    backgroundColor: '#22c55e',
  },
  tipsList: {
    margin: '8px 0',
    paddingLeft: '20px',
    fontSize: '13px',
    color: '#b0b0b0',
    lineHeight: '1.6',
  },
  footer: {
    marginTop: '12px',
    padding: '10px',
    backgroundColor: 'rgba(100, 100, 100, 0.1)',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#909090',
    textAlign: 'center',
  },
};
