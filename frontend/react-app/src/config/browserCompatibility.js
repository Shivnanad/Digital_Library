/**
 * Browser Detection and Voice API Compatibility
 * Provides cross-browser support for Speech Recognition
 */

export function getBrowserInfo() {
  const ua = navigator.userAgent;
  let browserName = 'Unknown';
  let browserVersion = '0';

  if (ua.indexOf('Firefox') > -1) {
    browserName = 'Firefox';
    browserVersion = ua.match(/Firefox\/([0-9]+)/)?.[1] || '0';
  } else if (ua.indexOf('Chrome') > -1 && ua.indexOf('Chromium') === -1) {
    browserName = 'Chrome';
    browserVersion = ua.match(/Chrome\/([0-9]+)/)?.[1] || '0';
  } else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
    browserName = 'Safari';
    browserVersion = ua.match(/Version\/([0-9]+)/)?.[1] || '0';
  } else if (ua.indexOf('Edge') > -1) {
    browserName = 'Edge';
    browserVersion = ua.match(/Edge\/([0-9]+)/)?.[1] || '0';
  }

  return { browserName, browserVersion, ua };
}

/**
 * Get Speech Recognition API with proper fallbacks
 */
export function initializeSpeechRecognition() {
  const { browserName, browserVersion } = getBrowserInfo();
  
  console.log(`[Browser] Detected: ${browserName} ${browserVersion}`);

  // Try multiple speech recognition APIs in order
  const SpeechRecognition = 
    window.SpeechRecognition || 
    window.webkitSpeechRecognition || 
    window.mozSpeechRecognition ||
    window.msSpeechRecognition;

  if (!SpeechRecognition) {
    console.error('[Voice] Speech Recognition API not available');
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    
    // Configure for specific browser needs
    if (browserName === 'Firefox') {
      // Firefox-specific configuration
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      
      console.log('[Browser] Firefox: Configured for speech recognition');
    } else if (browserName === 'Chrome' || browserName === 'Edge') {
      // Chrome/Edge configuration
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.language = 'en-US';
      recognition.maxAlternatives = 1;
      
      console.log('[Browser] Chrome/Edge: Configured for speech recognition');
    } else if (browserName === 'Safari') {
      // Safari configuration
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.language = 'en-US';
      
      console.log('[Browser] Safari: Configured for speech recognition');
    }

    return recognition;
  } catch (error) {
    console.error('[Voice] Failed to create Speech Recognition:', error);
    return null;
  }
}

/**
 * Request microphone permission with proper error handling
 */
export async function requestMicrophonePermission() {
  const { browserName } = getBrowserInfo();

  try {
    console.log(`[Permissions] Requesting microphone access (${browserName})...`);
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: false,
      },
    });

    console.log('[Permissions] ✓ Microphone access granted');
    
    // Stop the stream immediately - we only needed permission
    stream.getTracks().forEach(track => track.stop());
    
    return { success: true, error: null };
  } catch (error) {
    console.error('[Permissions] ✗ Microphone access denied:', error);
    
    let userMessage = 'Microphone access denied';
    
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDenied') {
      userMessage = 'Microphone permission denied. Please check browser settings.';
      if (browserName === 'Firefox') {
        userMessage += ' In Firefox: Settings → Privacy → Permissions → Microphone';
      } else if (browserName === 'Chrome') {
        userMessage += ' In Chrome: Settings → Privacy → Microphone';
      }
    } else if (error.name === 'NotFoundError') {
      userMessage = 'No microphone found on this device.';
    } else if (error.name === 'NotSupportedError') {
      userMessage = 'Microphone access not supported in this context.';
    } else if (error.name === 'SecurityError') {
      userMessage = 'Microphone access blocked by security policy. Use HTTPS or localhost.';
    }

    return { success: false, error: userMessage };
  }
}

/**
 * Check if browser supports Voice API
 */
export function checkVoiceSupport() {
  const { browserName } = getBrowserInfo();
  const hasAPI = !!(
    window.SpeechRecognition ||
    window.webkitSpeechRecognition ||
    window.mozSpeechRecognition ||
    window.msSpeechRecognition
  );

  const supportInfo = {
    isSupported: hasAPI,
    browserName,
    hasMediaDevices: !!navigator.mediaDevices?.getUserMedia,
  };

  console.log('[Voice Support]', supportInfo);

  if (!hasAPI) {
    console.warn('[Voice] Speech Recognition not supported in this browser');
  }

  return supportInfo;
}

/**
 * Get browser-specific error message
 */
export function handleSpeechError(error, browserName = 'Unknown') {
  const errorMap = {
    'no-speech': {
      message: 'No speech detected. Please speak clearly.',
      action: 'retry',
    },
    'audio-capture': {
      message: 'Microphone not found or permission denied.',
      action: 'check-permissions',
    },
    'network': {
      message: 'Network error. Check your internet connection.',
      action: 'retry',
    },
    'not-allowed': {
      message: 'Microphone permission denied. Check browser settings.',
      action: 'check-permissions',
    },
    'bad-grammar': {
      message: 'Speech recognition error. Try again.',
      action: 'retry',
    },
    'service-not-allowed': {
      message: 'Speech service not available. Try refreshing the page.',
      action: 'refresh',
    },
    'bad-request': {
      message: 'Invalid speech request. Try again.',
      action: 'retry',
    },
    'aborted': {
      message: 'Speech recognition was interrupted.',
      action: 'retry',
    },
  };

  const errorInfo = errorMap[error] || {
    message: `Speech error: ${error}`,
    action: 'retry',
  };

  // Add Firefox-specific guidance
  if (browserName === 'Firefox' && error === 'not-allowed') {
    errorInfo.message += '\n\nFirefox: go to about:preferences#privacy → Permissions → Microphone';
  }

  console.error(`[SpeechError] ${error}:`, errorInfo.message);
  
  return errorInfo;
}

/**
 * Test if microphone is working
 */
export async function testMicrophone() {
  console.log('[MicTest] Starting microphone test...');
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Create audio context to check level
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    
    source.connect(analyser);
    
    // Check for audio level
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let maxLevel = 0;
    
    for (let i = 0; i < 10; i++) {
      analyser.getByteFrequencyData(dataArray);
      const level = Math.max(...dataArray);
      maxLevel = Math.max(maxLevel, level);
      await new Promise(r => setTimeout(r, 50));
    }

    // Cleanup
    stream.getTracks().forEach(track => track.stop());
    audioContext.close();

    const isWorking = maxLevel > 10;
    console.log(`[MicTest] Audio level: ${maxLevel} - ${isWorking ? '✓ Working' : '⚠️ No audio'}`);
    
    return { isWorking, audioLevel: maxLevel };
  } catch (error) {
    console.error('[MicTest] Test failed:', error.message);
    return { isWorking: false, audioLevel: 0, error: error.message };
  }
}
