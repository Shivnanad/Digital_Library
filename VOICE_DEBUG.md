# Voice Control Debugging Checklist

## 1️⃣ BACKEND CHECKS
- [ ] Backend running on port 5000? (`npm run dev` in `/backend`)
  - Check terminal for: `Server running on port 5000`
  
- [ ] Ollama running? (`ollama serve` in separate terminal)
  - Check terminal for: Server starts or exits without error
  
- [ ] Model available? Run in terminal:
  ```bash
  ollama list
  ```
  - Must show `neural-chat` or similar

## 2️⃣ TEST OLLAMA DIRECTLY
Open PowerShell and test Ollama connection:
```powershell
# Test if Ollama is running
curl http://localhost:11434/api/tags

# Test a simple request
$body = @{
    model = "neural-chat"
    prompt = "Say hello"
    stream = $false
} | ConvertTo-Json

curl -Method POST -Uri http://localhost:11434/api/generate `
  -Headers @{"Content-Type"="application/json"} `
  -Body $body
```

If this fails → **Ollama is not running or not accessible**

## 3️⃣ FRONTEND BROWSER CONSOLE
Press F12 in browser → Console tab → Look for:

✅ Should see (good):
```
[VoiceContext] Route check: / Should enable: true
[VoiceContext] Enabling voice on route: /
[VoiceContext] Sending start to worker
[Worker] Started listening
[VoiceContext] Status changed to: listening
```

❌ If you see errors:
- "Speech Recognition API not supported" → Browser doesn't support Web Speech API
- "Worker not ready" → Worker initialization failed
- Network errors → Backend not reachable

## 4️⃣ SPEAK TEST
1. Go to home page (/ or /home)
2. Should see "🎤 Listening..." popup
3. Speak clearly: "Show me fantasy books"
4. In console, look for:
```
[voiceService] Processing transcript: show me fantasy books
[voiceService] Calling endpoint with token: false
[voiceService] Attempt 1/3
[voiceService] Response status: 200
[voiceService] Success response: {...}
```

## 5️⃣ BACKEND TERMINAL OUTPUT
Should see:
```
[voiceController] Received transcript: show me fantasy books
[voiceController] Calling Ollama at: http://localhost:11434
[voiceController] Using model: neural-chat
[voiceController] Ollama raw response: ....
[voiceController] Parsed command: {intent, query, ...}
```

## 6️⃣ COMMON FIXES

**Issue**: "Ollama is not running at http://localhost:11434"
- **Fix**: Start Ollama in terminal: `ollama serve`

**Issue**: "Cannot parse response from AI"
- **Fix**: Model might not be working, try:
  ```bash
  ollama pull mistral
  ```
  Then update voiceConfig to use "mistral" model

**Issue**: Microphone not working
- **Fix**: Browser might need permission
  - Allow microphone access when prompted
  - Clear browser cache and refresh

**Issue**: No response after 10 seconds
- **Fix**: Model is too slow
  - Use faster model: `ollama pull tinyllama`
  - Increase timeout in voiceController.js

## 7️⃣ QUICK TEST ENDPOINT
In browser, paste in console:
```javascript
fetch('http://localhost:5000/api/voice/status')
  .then(r => r.json())
  .then(console.log)
  .catch(e => console.error('❌ Backend not running:', e))
```

If returns `{available: true}` → Backend and Ollama both working ✅
