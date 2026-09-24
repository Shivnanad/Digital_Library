/**
 * Enhanced Transcript Analyzer
 * Validates that transcripts are from human voice (not background noise)
 * Uses multiple heuristics to ensure high confidence
 */

export class TranscriptAnalyzer {
  constructor() {
    // Patterns that typically indicate background noise/artifacts
    this.noisePatterns = [
      /^(um|uh|ah|hmm|huh|uh-huh|mm-hmm){1,3}$/i,  // Filler sounds only
      /^(beep|boop|buzz|ring|ding|ding-dong)s?$/i,  // Electronic sounds
      /^(silence|quiet|empty|wind|static|static noise)$/i,  // Ambient descriptions
      /^(scratch|thump|bang|crash|clang|tap|tap tap)s?$/i,  // Mechanical/impact sounds
      /^(laugh|cough|sneeze|snore|yawn|gasp|sigh|breath)s?$/i,  // Non-speech vocal sounds
      /^(okay|ok|yeah|no|yes){1}$/i,  // Single short utterances often misrecognized noise
    ];

    // Patterns that indicate actual human commands
    this.validCommandPatterns = [
      /\b(show|find|search|look for|get|open|go to|navigate|take me|add|remove|delete|save|like|favorite|play)\b/i,
      /\b(books|fiction|mystery|romance|science|history|fantasy|horror|thriller)\b/i,
      /\b(category|categories|wishlist|cart|checkout|account|profile|help|home)\b/i,
      /\b(by|from|about|what|where|how|why|when|which)\b/i,
    ];

    // Human speech characteristics
    this.speechCharacteristics = {
      minWordLength: 2,
      minWordCount: 2,           // At least 2 words for commands
      maxWordGap: 0.2,           // Max spacing variation between words (0-1)
      expectedWordTime: 0.5,     // Expected seconds per word (people speak ~120 wpm)
    };
  }

  /**
   * Analyze transcript for voice authenticity
   * Returns: { isValid: bool, confidence: 0-1, reason: string }
   */
  analyzeTranscript(transcript, duration = 0, audioMetrics = null) {
    if (!transcript || !transcript.trim()) {
      return { isValid: false, confidence: 0, reason: 'Empty transcript' };
    }

    const trimmed = transcript.trim();
    const score = {
      confidence: 0,
      checks: {},
    };

    // Check 1: Length and word count (more lenient)
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount < this.speechCharacteristics.minWordCount) {
      score.checks.wordCount = 0;  // Neutral, don't penalize short utterances
    } else if (wordCount < 20) {
      score.checks.wordCount = 0.3;
    } else if (wordCount < 50) {
      score.checks.wordCount = 0.2;
    } else {
      score.checks.wordCount = 0; // Very long less likely but don't penalize
    }

    // Check 2: Not a noise pattern (strong indicator)
    let isNoisePattern = this.noisePatterns.some(pattern => pattern.test(trimmed));
    if (isNoisePattern) {
      score.checks.noisePattern = -0.4; // Reduced penalty
    } else {
      score.checks.noisePattern = 0.2;
    }

    // Check 3: Contains valid command keywords
    let hasValidPattern = this.validCommandPatterns.some(pattern => pattern.test(trimmed));
    if (hasValidPattern) {
      score.checks.validPattern = 0.3;
    } else {
      score.checks.validPattern = 0; // Neutral if no pattern
    }

    // Check 4: Duration vs word count (realistic speaking pace)
    if (duration > 0) {
      const expectedDuration = wordCount * this.speechCharacteristics.expectedWordTime * 1000;
      const durationRatio = Math.min(duration / expectedDuration, 2.0);
      
      if (durationRatio > 0.3 && durationRatio < 2.0) {
        score.checks.duration = 0.15;
      } else if (durationRatio > 0.1) {
        score.checks.duration = 0.1;
      } else {
        score.checks.duration = -0.1; // Reduced penalty
      }
    }

    // Check 5: Character variety and naturalness
    const uniqueChars = new Set(trimmed.toLowerCase()).size;
    const charDiversity = uniqueChars / trimmed.toLowerCase().length;
    if (charDiversity > 0.15) {
      score.checks.charDiversity = 0.15;
    }

    // Check 6: Not repetitive (repeated words/letters indicate noise)
    const repeatPattern = /(.)\1{3,}|(\w+)(\s+\2){2,}/i;
    if (!repeatPattern.test(trimmed)) {
      score.checks.repetition = 0.1;
    } else {
      score.checks.repetition = -0.2; // Reduced penalty
    }

    // Check 7: Audio metrics (if provided from VAD)
    if (audioMetrics) {
      if (audioMetrics.confidence > 0.7) {
        score.checks.audioConfidence = 0.2;
      } else if (audioMetrics.confidence > 0.5) {
        score.checks.audioConfidence = 0.1;
      } else {
        score.checks.audioConfidence = -0.15;
      }

      // Energy should be consistent with speech, not spike-like (noise)
      if (audioMetrics.energyVariance && audioMetrics.energyVariance < 0.6) {
        score.checks.energyStability = 0.1;
      } else {
        score.checks.energyStability = -0.05;
      }
    }

    // Calculate total confidence (weighted average)
    const totalScore = Object.values(score.checks).reduce((a, b) => a + b, 0);
    score.confidence = Math.max(0, Math.min(1, totalScore / Object.keys(score.checks).length));

    // Determine validity - LOWERED THRESHOLD for actual usage
    // 65% was unrealistic - most real speech gets 30-50%
    const isValid = score.confidence > 0.3; // 30% threshold - much more practical

    console.log('[TranscriptAnalyzer]', {
      transcript: trimmed.substring(0, 50),
      wordCount,
      confidence: (score.confidence * 100).toFixed(0) + '%',
      checks: score.checks,
      isValid,
    });

    return {
      isValid,
      confidence: score.confidence,
      checks: score.checks,
      reason: this.getConfidenceReason(score.checks, score.confidence),
    };
  }

  /**
   * Generate human-readable confidence reason
   */
  getConfidenceReason(checks, confidence) {
    if (checks.noisePattern && checks.noisePattern <= -0.2) {
      return 'Detected as background noise pattern';
    }
    if (confidence < 0.15) {
      return 'Very low confidence - likely background noise';
    }
    if (confidence < 0.3) {
      return 'Low confidence - unclear speech';
    }
    if (confidence < 0.5) {
      return 'Medium confidence - accepted';
    }
    return 'Valid human voice - high confidence';
  }

  /**
   * Filter repeated/stuttering words
   */
  cleanupStuttering(transcript) {
    return transcript
      .replace(/\b(\w+)\s+\1+\b/gi, '$1') // Remove repeated words
      .replace(/(.)\1{2,}/g, '$1'); // Remove repeated letters
  }

  /**
   * Get confidence multiplier based on speech characteristics
   */
  getConfidenceMultiplier(transcript) {
    let multiplier = 1.0;

    // Longer transcripts are generally more reliable
    const words = transcript.split(/\s+/).length;
    if (words > 5) multiplier *= 1.1;
    if (words > 10) multiplier *= 1.15;

    // Transcripts with typical command words get boost
    if (/\b(search|find|show|go|add|remove)\b/i.test(transcript)) {
      multiplier *= 1.2;
    }

    // Transcripts with person/product names get slight boost
    if (/\b[A-Z][\w\s]*\b/.test(transcript)) {
      multiplier *= 1.05;
    }

    return Math.min(multiplier, 1.5); // Cap at 1.5x
  }
}

/**
 * Singleton instance
 */
let analyzerInstance = null;

export function getTranscriptAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new TranscriptAnalyzer();
  }
  return analyzerInstance;
}
