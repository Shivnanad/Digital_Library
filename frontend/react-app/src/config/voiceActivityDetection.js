/**
 * Voice Activity Detection (VAD) Module
 * Distinguishes between human voice and background noise using audio analysis
 * 
 * Key techniques:
 * 1. Energy level analysis - Human speech has specific energy patterns
 * 2. Frequency analysis - Human voice primarily in 85-255 Hz (fundamental frequency)
 * 3. Zero-crossing rate - Human speech has moderate ZCR
 * 4. Spectral centroid - Voice concentration in mid-range frequencies
 * 5. Duration filtering - Human speech typically longer than noise bursts
 */

export class VoiceActivityDetector {
  constructor() {
    // Audio context for analysis
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.scriptProcessor = null;
    
    // Buffer for analysis
    this.audioBuffer = [];
    this.maxBufferSize = 4096;
    
    // VAD thresholds (calibrated for typical environments)
    this.thresholds = {
      minEnergyLevel: 0.01,        // Minimum energy to be considered voice
      maxNoiseEnergy: 0.03,        // Background noise baseline
      minSpeechFreq: 80,           // Hz - Lower bound of human voice
      maxSpeechFreq: 400,          // Hz - Upper bound for speech fundamentals
      minDuration: 200,            // ms - Minimum speech burst
      energyRatio: 1.5,            // Speech energy should be 1.5x noise baseline
      zcRateMin: 0.08,             // Minimum zero-crossing rate for voice
      zcRateMax: 0.35,             // Maximum ZCR to filter excessive noise
    };

    // Running statistics for noise floor estimation
    this.noiseFloor = 0.02;
    this.noiseFloorAlpha = 0.95;   // Exponential moving average factor
    this.silenceCounter = 0;
    this.maxSilenceFrames = 20;    // ~500ms of silence to update noise floor

    // Voice detection state
    this.isVoiceActive = false;
    this.voiceStartTime = 0;
    this.confidenceHistory = [];
    this.maxHistoryLength = 5;

    console.log('[VAD] Initialized Voice Activity Detector');
  }

  /**
   * Initialize audio context and microphone access
   */
  async initialize() {
    try {
      // Create audio context
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContext();

      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false, // We want raw audio
        }
      });

      const source = this.audioContext.createMediaStreamSource(stream);
      
      // Create analyser for frequency analysis
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      source.connect(this.analyser);

      // Create script processor for audio analysis
      const bufferSize = 4096;
      this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
      
      this.scriptProcessor.onaudioprocess = (e) => this.analyzeAudioFrame(e);
      
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);

      console.log('[VAD] Audio context initialized successfully');
      return true;
    } catch (error) {
      console.error('[VAD] Failed to initialize audio context:', error);
      return false;
    }
  }

  /**
   * Analyze a single audio frame and determine if it's human voice
   */
  analyzeAudioFrame(event) {
    const inputData = event.inputBuffer.getChannelData(0);
    
    // Calculate frame energy
    const energy = this.calculateEnergy(inputData);
    
    // Update noise floor
    if (energy < this.noiseFloor * 1.5) {
      this.silenceCounter++;
      if (this.silenceCounter > this.maxSilenceFrames) {
        this.updateNoiseFloor(energy);
      }
    } else {
      this.silenceCounter = 0;
    }

    // Analyze frame characteristics
    const zeroCrossingRate = this.calculateZeroCrossingRate(inputData);
    const spectralFeatures = this.analyzeFrequencies();
    
    // Determine voice confidence
    const confidence = this.calculateVoiceConfidence(
      energy,
      zeroCrossingRate,
      spectralFeatures
    );

    // Track confidence history for smoothing
    this.confidenceHistory.push(confidence);
    if (this.confidenceHistory.length > this.maxHistoryLength) {
      this.confidenceHistory.shift();
    }

    // Calculate smoothed confidence
    const smoothedConfidence = this.getSmoothedConfidence();

    // Determine if voice is active
    const wasVoiceActive = this.isVoiceActive;
    this.isVoiceActive = smoothedConfidence > 0.7; // 70% confidence threshold

    // Log state changes
    if (this.isVoiceActive && !wasVoiceActive) {
      this.voiceStartTime = Date.now();
      console.log('[VAD] 🎤 Voice detected - confidence:', (smoothedConfidence * 100).toFixed(0) + '%');
    } else if (!this.isVoiceActive && wasVoiceActive) {
      const duration = Date.now() - this.voiceStartTime;
      console.log(`[VAD] 🔇 Voice ended - duration: ${duration}ms`);
    }

    return {
      isVoiceActive: this.isVoiceActive,
      confidence: smoothedConfidence,
      energy: energy,
      zeroCrossingRate: zeroCrossingRate,
      spectralFeatures: spectralFeatures,
      noiseFloor: this.noiseFloor,
    };
  }

  /**
   * Calculate RMS energy of audio frame
   */
  calculateEnergy(audioData) {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }

  /**
   * Calculate zero-crossing rate (transitions from positive to negative)
   * Human speech has moderate ZCR, noise has very high or very low ZCR
   */
  calculateZeroCrossingRate(audioData) {
    let zeroCrossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] > 0 && audioData[i - 1] <= 0) ||
          (audioData[i] <= 0 && audioData[i - 1] > 0)) {
        zeroCrossings++;
      }
    }
    return zeroCrossings / audioData.length;
  }

  /**
   * Analyze frequency characteristics
   * Returns spectral centroid and energy distribution
   */
  analyzeFrequencies() {
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    const nyquist = this.audioContext.sampleRate / 2;
    const binWidth = nyquist / freqData.length;

    let weightedSum = 0;
    let totalEnergy = 0;
    let speechBandEnergy = 0; // Energy in human speech band (80-400 Hz)

    for (let i = 0; i < freqData.length; i++) {
      const freq = i * binWidth;
      const magnitude = freqData[i];

      weightedSum += freq * magnitude;
      totalEnergy += magnitude;

      // Count energy in speech fundamental frequency band
      if (freq >= this.thresholds.minSpeechFreq && 
          freq <= this.thresholds.maxSpeechFreq) {
        speechBandEnergy += magnitude;
      }
    }

    const spectralCentroid = totalEnergy > 0 ? weightedSum / totalEnergy : 0;
    const speechEnergyRatio = totalEnergy > 0 ? speechBandEnergy / totalEnergy : 0;

    return {
      spectralCentroid: spectralCentroid,
      speechEnergyRatio: speechEnergyRatio, // 0-1, higher = more speech-like
      totalEnergy: totalEnergy,
    };
  }

  /**
   * Calculate voice confidence score (0-1)
   */
  calculateVoiceConfidence(energy, zcr, spectralFeatures) {
    let confidence = 0;
    let factors = 0;

    // Factor 1: Energy level check
    if (energy > this.noiseFloor * this.thresholds.energyRatio) {
      confidence += 0.3; // 30% weight
      factors++;
    }

    // Factor 2: Zero-crossing rate check (middle ground, not too high/low)
    if (zcr >= this.thresholds.zcRateMin && zcr <= this.thresholds.zcRateMax) {
      confidence += 0.2; // 20% weight
      factors++;
    }

    // Factor 3: Spectral centroid in reasonable range
    if (spectralFeatures.spectralCentroid > this.thresholds.minSpeechFreq &&
        spectralFeatures.spectralCentroid < 2000) {
      confidence += 0.25; // 25% weight
      factors++;
    }

    // Factor 4: Speech band energy ratio (high speech frequency content)
    if (spectralFeatures.speechEnergyRatio > 0.3) {
      confidence += 0.25; // 25% weight
      factors++;
    }

    return confidence / (factors || 1);
  }

  /**
   * Update estimated noise floor using exponential moving average
   */
  updateNoiseFloor(energy) {
    this.noiseFloor = this.noiseFloorAlpha * this.noiseFloor + 
                      (1 - this.noiseFloorAlpha) * energy;
  }

  /**
   * Get smoothed confidence from history
   */
  getSmoothedConfidence() {
    if (this.confidenceHistory.length === 0) return 0;
    return this.confidenceHistory.reduce((a, b) => a + b, 0) / this.confidenceHistory.length;
  }

  /**
   * Check if speech duration is reasonable (not too short, not too long)
   */
  isValidSpeechDuration() {
    if (!this.isVoiceActive) return true;
    
    const duration = Date.now() - this.voiceStartTime;
    return duration >= this.thresholds.minDuration;
  }

  /**
   * Calibrate VAD for current environment
   * Call this during setup to adapt to ambient noise
   */
  calibrate(durationMs = 2000) {
    return new Promise((resolve) => {
      console.log('[VAD] Calibrating for current environment...');
      const startTime = Date.now();
      let energyReadings = [];

      const interval = setInterval(() => {
        if (Date.now() - startTime > durationMs) {
          clearInterval(interval);
          
          // Set noise floor to average of readings
          const avgEnergy = energyReadings.reduce((a, b) => a + b, 0) / energyReadings.length;
          this.noiseFloor = avgEnergy * 1.2; // Add 20% margin
          
          console.log(`[VAD] Calibration complete - Noise floor: ${(this.noiseFloor * 1000).toFixed(1)} mV`);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Get current VAD statistics
   */
  getStats() {
    return {
      isVoiceActive: this.isVoiceActive,
      confidence: this.getSmoothedConfidence(),
      noiseFloor: this.noiseFloor,
      voiceDuration: this.isVoiceActive ? Date.now() - this.voiceStartTime : 0,
    };
  }

  /**
   * Cleanup and stop analysis
   */
  cleanup() {
    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
    }
    if (this.analyser) {
      this.analyser.disconnect();
    }
    // Note: Don't close audioContext if we might need it again
    console.log('[VAD] Cleaned up');
  }
}

/**
 * Shared VAD instance (singleton pattern)
 */
let vadInstance = null;

export function getVADInstance() {
  if (!vadInstance) {
    vadInstance = new VoiceActivityDetector();
  }
  return vadInstance;
}
