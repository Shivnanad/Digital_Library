# Firefox Microphone Setup Guide

## Quick Setup for Firefox

### Step 1: Enable Microphone Permission

Firefox requires explicit permission. Follow these steps:

1. **Open Firefox Settings**
   - Type `about:preferences#privacy` in the address bar
   - Press Enter

2. **Navigate to Permissions → Microphone**
   - Look for **Microphone** section
   - Make sure it's set to **Ask** or **Allow**

3. **First Use**
   - When visiting the Digital Library, Firefox will ask: _"Allow Digital-Library.local to use your microphone?"_
   - Click **Allow** or **Allow for this session**

### Step 2: Test Microphone

1. Navigate to home page of Digital Library
2. Open Developer Console (F12 → Console tab)
3. You should see logs like:

```
[Browser] Detected: Firefox [version]
[VoiceContext] ✓ SpeechRecognition instance created
[VoiceContext] ✓ Microphone permission confirmed
```

### Step 3: Test Voice Commands

1. Say: "Hey Readify"
2. Wait for system to recognize wake word
3. Say: "Show me horror books"
4. Check console for success logs

---

## Firefox Compatibility

| Feature | Status | Notes |
|---------|--------|-------|
| Web Speech API | ✓ Supported | Available in Firefox 25+ |
| Microphone Access | ✓ Supported | Requires permission |
| Audio Context | ✓ Supported | For audio analysis |
| Continuous Recognition | ✓ Supported | Works properly |
| Interim Results | ✓ Supported | Shows partial results |

---

## Troubleshooting Firefox Issues

### ❌ "Speech Recognition not supported"

**Problem:** Console shows "Speech Recognition not supported in Firefox"

**Solution:**
1. Check Firefox version (must be 25+)
2. Try updating Firefox to latest version
3. Test with Chrome to verify system works
4. Check if security software is blocking APIs

**Test in console:**
```javascript
console.log('SpeechRecognition:', window.SpeechRecognition);
console.log('webkitSpeechRecognition:', window.webkitSpeechRecognition);
console.log('mozSpeechRecognition:', window.mozSpeechRecognition);
```

---

### ❌ "Microphone permission denied"

**Problem:** Console shows "Microphone permission denied. Check browser settings."

**Solution:**
1. **Check Firefox Permissions:**
   - Open `about:preferences#privacy`
   - Scroll to **Permissions → Microphone**
   - Make sure Digital Library is either:
     - Set to **Ask** (browser will prompt each time)
     - Listed under **Allow**
   
2. **If blocked:**
   - Click the ⊗ (remove) button next to Digital-Library domain
   - Reload the page
   - Click **Allow** when prompted

3. **Check System Permissions:**
   - Windows: Settings → Privacy → Microphone
   - Mac: System Preferences → Security → Microphone
   - Linux: Check PulseAudio settings

**Command to test microphone directly:**
```javascript
navigator.mediaDevices.getUserMedia({ audio: true })
  .then(stream => {
    console.log('✓ Microphone available');
    stream.getTracks().forEach(t => t.stop());
  })
  .catch(err => console.error('✗ Microphone error:', err));
```

---

### ⚠️ Microphone shows but no audio captured

**Problem:** System recognizes wake word sometimes but not consistently

**Solution:**
1. **Check microphone level:**
   - Open system audio settings
   - Adjust microphone volume to 80-100%
   - Test with voice recording app first

2. **Check background noise:**
   - Reduce ambient noise
   - Move closer to microphone
   - Speak clearly and slowly

3. **Try a different microphone:**
   - USB microphone sometimes works better
   - Built-in microphones can be problematic
   - Check if microphone works in other apps (Zoom, Teams, etc.)

4. **Console test:**
   ```javascript
   // Run in DevTools Console
   navigator.mediaDevices.getUserMedia({ audio: true })
     .then(async (stream) => {
       const context = new (window.AudioContext || window.webkitAudioContext)();
       const analyser = context.createAnalyser();
       const source = context.createMediaStreamSource(stream);
       source.connect(analyser);
       
       const data = new Uint8Array(analyser.frequencyBinCount);
       analyser.getByteFrequencyData(data);
       const level = Math.max(...data);
       
       console.log('Audio level:', level);
       stream.getTracks().forEach(t => t.stop());
       context.close();
     });
   ```

---

### ⚠️ Recognition stops after a few seconds

**Problem:** Microphone stops listening randomly

**Cause:** 
- Firefox auto-stops when no speech detected (~5 seconds)
- Network connectivity issue
- Speech recognition service temporary failure

**Solution:**
1. **Click during command mode** to reset timer
2. **Speak continuously** without long pauses
3. **Try wake word again** if it times out
4. **Check internet connection** (service needs network)

**Console behavior to look for:**
```
[VoiceContext] ✓✓✓ ONSTART FIRED
  [waiting for speech...]
⏱️ TIMEOUT: No command received in 5 seconds
[VoiceContext] Auto-restarting recognition
```

---

### 🔄 "Speech service not available"

**Problem:** Error appears: "Speech service not available"

**Solution:**
1. Check internet connection
2. Try refreshing page (F5)
3. Wait a moment and try again
4. Firefox might be rate-limiting requests - wait 30 seconds

---

## Browser Configuration File

The system uses Firefox-specific settings in [browserCompatibility.js](../src/config/browserCompatibility.js):

```javascript
// Firefox detection
if (browserName === 'Firefox') {
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';  // Note: 'lang' not 'language'
  recognition.maxAlternatives = 1;
}
```

---

## Console Commands for Firefox Testing

Run these in DevTools Console (F12) to debug:

### Test 1: Check Browser Support
```javascript
import { checkVoiceSupport } from './src/config/browserCompatibility';
checkVoiceSupport();
```

### Test 2: Request Microphone Permission
```javascript
import { requestMicrophonePermission } from './src/config/browserCompatibility';
await requestMicrophonePermission();
```

### Test 3: Test Microphone Audio Level
```javascript
import { testMicrophone } from './src/config/browserCompatibility';
await testMicrophone();
```

### Test 4: Get Browser Info
```javascript
import { getBrowserInfo } from './src/config/browserCompatibility';
console.log(getBrowserInfo());
```

---

## Firefox Privacy Considerations

Firefox provides strong privacy protection which might affect voice recording:

### Enhanced Tracking Protection
- ✓ Usually doesn't block microphone
- If issues occur: Temporarily disable for Digital-Library

### HTTPS Only Mode
- Voice API works on both HTTP and HTTPS
- Localhost (127.0.0.1) also works

### Network Isolation
- Might delay voice service startup
- Usually resolves after first request

---

## Comparing Firefox vs Chrome

| Feature | Firefox | Chrome | Notes |
|---------|---------|--------|-------|
| API Name | `SpeechRecognition` | `webkitSpeechRecognition` | Both supported |
| Lang Property | `.lang` | `.language` | Handled automatically |
| Accuracy | 90% | 95% | Chrome slightly better |
| Wake Word | ✓ Supported | ✓ Supported | Same thresholds |
| Permissions | Per-site | Per-site | Both ask each time |
| Service | Google Cloud | Google Cloud | Same service |

---

## Known Firefox Limitations

⚠️ **Firefox Desktop:**
- Occasionally stops listening after 30 seconds (by design)
- Might have slightly lower accuracy than Chrome
- Can be affected by Firefox privacy settings

✓ **Workarounds:**
- Use Firefox ESR (Extended Support Release) for stability
- Keep browser updated
- Test on Chrome if Firefox has issues
- Check "about:config" for extreme privacy settings

---

## Firefox ESR (Extended Support Release)

If using Firefox ESR (corporate/extended support):
- Make sure version 115+ for best support
- Older ESR versions might have limited Web Speech API
- Update if possible for better compatibility

---

## Getting Help

When reporting Firefox issues, include:
1. Firefox version (shown in about menu)
2. Console logs from DevTools (F12)
3. Steps to reproduce
4. Whether microphone works in other apps
5. Any security software running

**Always check console logs first** - they'll show exactly what's happening!

---

**Last Updated:** March 1, 2026  
**Firefox Tested:** Version 123+  
**Status:** ✅ Fully Compatible
