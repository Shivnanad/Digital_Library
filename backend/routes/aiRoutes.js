const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');

// AI endpoints
router.post('/chat', aiController.chatWithAI);
router.post('/summarize', aiController.summarizeContent);
router.post('/highlights', aiController.extractHighlights);
router.post('/translate', aiController.translateWord);
router.post('/questions', aiController.generateQuestions);
router.post('/analyze-theme', aiController.analyzeTheme);

module.exports = router;
