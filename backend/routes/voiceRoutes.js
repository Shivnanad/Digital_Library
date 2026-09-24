const express = require('express');
const {
  processVoiceCommand,
  checkOllamaStatus,
  executeVoiceNavigation,
} = require('../controllers/voiceController');

const router = express.Router();

/**
 * POST /api/voice/process
 * Process voice command and extract intent using Ollama
 */
router.post('/process', processVoiceCommand);

/**
 * GET /api/voice/status
 * Check if Ollama is running and available
 */
router.get('/status', checkOllamaStatus);

/**
 * POST /api/voice/navigate
 * Execute voice-based navigation
 */
router.post('/navigate', executeVoiceNavigation);

module.exports = router;
