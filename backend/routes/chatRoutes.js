const express = require("express");
const router = express.Router();
const { chat } = require("../controllers/chatController");

// POST /api/chat — no auth required (user check optional)
router.post("/", chat);

module.exports = router;
