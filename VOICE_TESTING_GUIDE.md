# Voice Detection Testing Guide

## Quick Test Checklist

### Setup
- [ ] Backend running: `npm run dev` (backend folder)
- [ ] Frontend running: `npm run dev` (frontend/react-app folder)
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Navigate to home page

### Test 1: System Activates on Wake Word ✓
**Steps:**
1. Say: "Hey Readify" 
2. Watch console for logs

**Expected:**
```
[VoiceContext] ✓✓ VALID FINAL TRANSCRIPT
Human Voice Analysis: ... confidence: 85%+
🎯🎯🎯 WAKE WORD DETECTED - ENTERING COMMAND MODE 🎯🎯🎯
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 2: Ignores Background Noise - Electronic Sounds ✗
**Steps:**
1. Play a beeping sound (phone alarm, microwave, etc.)
2. Watch console

**Expected:**
```
[VoiceContext] ✓✓ VALID FINAL TRANSCRIPT
Text: "beep beep beep..."
Human Voice Analysis: ... confidence: 10%
Detected as background noise pattern
❌ REJECTED: Detected as background noise
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 3: Ignores Background Noise - Filler Sounds ✗
**Steps:**
1. Say only: "Um um um" or "Hmm hmm"
2. Watch console

**Expected:**
```
Human Voice Analysis: ... confidence: 20%
Detected as background noise pattern
❌ REJECTED: Detected as background noise
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 4: Ignores Non-Wake Words ℹ️
**Steps:**
1. Say: "Show me fantasy books" (without wake word)
2. Watch console

**Expected:**
```
ℹ️ Text detected but no wake word
Still listening for "Readify"...
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 5: Processes Command After Wake Word ✓
**Steps:**
1. Say: "Readify show me mystery books"
2. Wait for page to load

**Expected:**
```
🎯🎯🎯 WAKE WORD DETECTED
Say your command now...
(new search page loads with mystery books)
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 6: Filters Low Confidence Speech ✗
**Steps:**
1. Whisper very quietly: "Readify"
2. Watch console

**Expected:**
```
Human Voice Analysis: ... confidence: 35%
❌ WAKE WORD REJECTED: Not enough human voice confidence
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 7: Accepts Valid Commands ✓
**Steps:**
1. Say: "Readify find horror books"
2. System should search

**Expected:**
```
🎤 User command: find horror books
✓ Backend response
✓ Navigation to search page
```

**Result:** ✓ Pass / ✗ Fail

---

### Test 8: Filters Very Short Text ✗
**Steps:**
1. Say: "Readify add"
2. Watch console

**Expected:**
```
❌ REJECTED: Too few words (likely noise)
Min words: 2 | Got: 1
```

**Result:** ✓ Pass / ✗ Fail

---

## Console Commands for Manual Testing

Open DevTools Console and run these:

```javascript
// Get transcript analyzer instance
const analyzer = new TranscriptAnalyzer();

// Test noise rejection
analyzer.analyzeTranscript("beep beep beep");
// → isValid: false, confidence: 15%, reason: "Detected as background noise pattern"

// Test human voice acceptance
analyzer.analyzeTranscript("show me fantasy books");
// → isValid: true, confidence: 72%, reason: "Valid human voice"

// Test low word count rejection
analyzer.analyzeTranscript("um");
// → isValid: false, confidence: 20%, reason: "..."

// Test valid command acceptance
analyzer.analyzeTranscript("find mystery novels please");
// → isValid: true, confidence: 80%, reason: "Valid human voice"
```

## Logs to Watch For

### ✓ SUCCESS logs:
- `🎯🎯🎯 WAKE WORD DETECTED`
- `User command:` (in command mode)
- `✓ Backend response`
- `Executing action`
- `Navigation triggered`

### ✗ REJECTION logs:
- `❌ REJECTED: Detected as background noise`
- `❌ WAKE WORD REJECTED: Not enough human voice confidence`
- `❌ REJECTED: Too few words`
- `High confidence - likely background noise`

### ℹ️ INFO logs:
- `Text detected but no wake word`
- `Still listening for "Readify"`
- `Confidence:` (shows percentage)

## Troubleshooting

### Issue: System doesn't respond to wake word
**Check:**
- [ ] Microphone is working (browser should ask for permission)
- [ ] Web page is NOT in login/checkout/payment route (voice disabled)
- [ ] Speaking clearly: "Hey Readify" or "Readify"
- [ ] Console shows high confidence (>75%)
- [ ] Check `CONFIDENCE_THRESHOLDS` in voiceConfig.js

### Issue: System responds to background noise
**Check:**
- [ ] Background sound is being detected as "beep" or noise pattern
- [ ] Check if `analyzers.noisePatterns` need expansion
- [ ] Verify `WAKE_WORD_HUMAN_VOICE` threshold (should be ~0.75)
- [ ] Check `transcriptAnalyzer` confidence calculation

### Issue: Commands not working after wake word
**Check:**
- [ ] You said the wake word first
- [ ] Console shows "ENTERING COMMAND MODE"
- [ ] Command has at least 2 words
- [ ] Backend is running (`localhost:5000/api/...`)
- [ ] Check Network tab for API call success

### Issue: Too many false rejections
**Solution:**
- Lower `CONFIDENCE_THRESHOLDS.WAKE_WORD_HUMAN_VOICE` to 0.65
- Lower `CONFIDENCE_THRESHOLDS.COMMAND_HUMAN_VOICE` to 0.50
- Add known good patterns to `validCommandPatterns`

### Issue: Too many false acceptances
**Solution:**
- Raise thresholds to 0.85+
- Expand `noisePatterns` with more patterns
- Reduce `speechEnergyRatio` threshold in VAD

## Reporting Results

When reporting test results, include:
1. Test number (1-8)
2. Pass/Fail
3. Browser used (Chrome/Firefox/Safari)
4. What was said
5. What console showed
6. Expected vs actual behavior

---

**Last Updated**: March 1, 2026
**Status**: ✅ Ready for testing
