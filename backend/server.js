const express = require("express");
const dotenv = require("dotenv");

// Load .env FIRST before anything else
dotenv.config();

const cors = require("cors");

const connectDB = require("./config/db");
const categoryRoutes = require("./routes/categoryRoutes");
const bookRoutes = require("./routes/bookRoutes");
const cartRoutes = require("./routes/cartRoutes");
const authRoutes = require("./routes/authRoutes");   // ✅
const otpRoutes = require("./routes/otpRoutes");     // ✅ OTP Routes
const path = require("path");
const adminRoutes = require("./routes/adminRoutes");
const playlistRoutes = require("./routes/playlistRoutes");
const orderRoutes = require("./routes/orderRoutes");
const chatRoutes  = require("./routes/chatRoutes");
const aiRoutes = require("./routes/aiRoutes");
const voiceRoutes = require("./routes/voiceRoutes");

const app = express();

// Minimal CORS: allow local admin panel + React dev server origins.
const defaultAllowedOrigins = [
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
const envAllowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // non-browser tools
    return callback(null, allowedOrigins.has(origin));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Simple, robust preflight handler that mirrors the corsOptions without using route parsing
app.use((req, res, next) => {
  if (req.method !== 'OPTIONS') return next();
  const origin = req.headers.origin || '';
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  return res.sendStatus(204);
});
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("Digital Library API running");
});

app.use("/api/categories", categoryRoutes);
app.use("/api/books", bookRoutes);
app.use("/api/auth", authRoutes);     // ✅
app.use("/api/otp", otpRoutes);       // ✅ OTP Routes
app.use("/api/cart", cartRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/playlists", playlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/chat",   chatRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/voice", voiceRoutes);

app.use(
  "/pdfs",
  express.static(path.join(__dirname, "public", "pdfs"))
);

// Serve book cover images from /covers
app.use(
  "/covers",
  express.static(path.join(__dirname, "public", "covers"))
);

// Serve user avatar images from /avatars
app.use(
  "/avatars",
  express.static(path.join(__dirname, "public", "avatars"))
);

// Serve simple admin panel static files at /admin
app.use(
  "/admin",
  express.static(path.join(__dirname, "..", "admin-panel"))
);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Setup socket.io for real-time events
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: { origin: '*' }
});

// In-memory support chat sessions for live user/admin messaging.
const supportSessions = new Map();

function normalizeConversationId(rawId) {
  if (!rawId || typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  return trimmed.length ? trimmed : null;
}

function sanitizeText(input) {
  return String(input || '').trim().slice(0, 2000);
}

function sanitizeAudioDataUrl(input) {
  const value = String(input || '').trim();
  if (!value.startsWith('data:audio/')) return '';
  // Keep payload bounded to avoid oversized in-memory sessions.
  if (value.length > 1_500_000) return '';
  return value;
}

function supportRoom(conversationId) {
  return `support:${conversationId}`;
}

function serializeSupportSession(session) {
  return {
    conversationId: session.conversationId,
    userName: session.userName,
    userEmail: session.userEmail,
    status: session.status,
    assignedAdmin: session.assignedAdmin || null,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    unreadForAdmin: Boolean(session.unreadForAdmin),
    lastMessage: session.messages.length ? session.messages[session.messages.length - 1] : null,
    messages: session.messages,
  };
}

function getOrCreateSupportSession({ conversationId, userName, userEmail }) {
  let session = supportSessions.get(conversationId);
  const now = new Date().toISOString();
  if (!session) {
    session = {
      conversationId,
      userName: sanitizeText(userName) || 'Readify User',
      userEmail: sanitizeText(userEmail) || 'unknown@readify.app',
      status: 'bot',
      assignedAdmin: null,
      createdAt: now,
      updatedAt: now,
      unreadForAdmin: false,
      greetedAgents: [],
      messages: [],
    };
    supportSessions.set(conversationId, session);
  }
  return session;
}

// attach io to app locals so controllers can emit
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('support:user:join', (payload = {}) => {
    const conversationId = normalizeConversationId(payload.conversationId);
    if (!conversationId) return;

    const session = getOrCreateSupportSession({
      conversationId,
      userName: payload.userName,
      userEmail: payload.userEmail,
    });

    socket.join(supportRoom(conversationId));
    socket.emit('support:session', serializeSupportSession(session));
  });

  socket.on('support:request', (payload = {}) => {
    const conversationId = normalizeConversationId(payload.conversationId);
    if (!conversationId) return;

    const session = getOrCreateSupportSession({
      conversationId,
      userName: payload.userName,
      userEmail: payload.userEmail,
    });

    const reason = sanitizeText(payload.reason || payload.text || 'Customer requested live support');
    const now = new Date().toISOString();
    session.status = 'waiting-admin';
    session.unreadForAdmin = true;
    session.updatedAt = now;

    const emergencyMessage = {
      id: `${conversationId}-emergency-${Date.now()}`,
      senderType: 'system',
      senderName: 'Readify Support Bot',
      text: 'Please wait, I am connecting you to a customer support agent.',
      createdAt: now,
    };
    session.messages.push(emergencyMessage);

    io.to(supportRoom(conversationId)).emit('support:message', emergencyMessage);
    io.to('support_admins').emit('support:request', {
      conversationId,
      userName: session.userName,
      userEmail: session.userEmail,
      reason,
      emergency: true,
      createdAt: now,
    });
    io.to('support_admins').emit('support:list', Array.from(supportSessions.values()).map(serializeSupportSession));
  });

  socket.on('support:user:endConversation', (payload = {}) => {
    const conversationId = normalizeConversationId(payload.conversationId);
    if (!conversationId) return;

    const session = supportSessions.get(conversationId);
    if (!session) return;

    const endedBy = sanitizeText(payload.endedBy || session.userName || 'Readify User');
    const now = new Date().toISOString();

    io.to(supportRoom(conversationId)).emit('support:conversation:ended', {
      conversationId,
      endedBy,
      createdAt: now,
    });

    supportSessions.delete(conversationId);

    io.to('support_admins').emit('support:ended', {
      conversationId,
      endedBy,
      createdAt: now,
    });
    io.to('support_admins').emit('support:list', Array.from(supportSessions.values()).map(serializeSupportSession));
  });

  socket.on('support:admin:subscribe', () => {
    socket.join('support_admins');
    socket.emit('support:list', Array.from(supportSessions.values()).map(serializeSupportSession));
  });

  socket.on('support:admin:joinConversation', (payload = {}) => {
    const conversationId = normalizeConversationId(payload.conversationId);
    if (!conversationId) return;

    const session = supportSessions.get(conversationId);
    if (!session) return;

    const adminName = sanitizeText(payload.adminName || 'Support Agent');
    const previousAdmin = session.assignedAdmin;
    const alreadyLive = session.status === 'live';
    socket.join(supportRoom(conversationId));
    session.assignedAdmin = adminName;
    session.status = 'live';
    session.unreadForAdmin = false;
    session.updatedAt = new Date().toISOString();

    if (previousAdmin !== adminName || !alreadyLive) {
      io.to(supportRoom(conversationId)).emit('support:agent-joined', {
        conversationId,
        adminName,
        createdAt: session.updatedAt,
      });
    }

    if (!Array.isArray(session.greetedAgents)) {
      session.greetedAgents = [];
    }

    if (!session.greetedAgents.includes(adminName)) {
      session.greetedAgents.push(adminName);
      const greetingMessage = {
        id: `${conversationId}-agent-intro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        senderType: 'admin',
        senderName: adminName,
        text: `Hello, I'm ${adminName}. How can I help you?`,
        createdAt: new Date().toISOString(),
      };
      session.messages.push(greetingMessage);
      session.updatedAt = greetingMessage.createdAt;
      io.to(supportRoom(conversationId)).emit('support:message', greetingMessage);
    }

    io.to('support_admins').emit('support:list', Array.from(supportSessions.values()).map(serializeSupportSession));
  });

  socket.on('support:admin:deleteConversation', (payload = {}) => {
    const conversationId = normalizeConversationId(payload.conversationId);
    if (!conversationId) return;

    const session = supportSessions.get(conversationId);
    if (!session) return;

    const deletedBy = sanitizeText(payload.adminName || 'Support Agent');
    const now = new Date().toISOString();

    io.to(supportRoom(conversationId)).emit('support:conversation:deleted', {
      conversationId,
      deletedBy,
      createdAt: now,
    });

    supportSessions.delete(conversationId);

    io.to('support_admins').emit('support:deleted', {
      conversationId,
      deletedBy,
      createdAt: now,
    });
    io.to('support_admins').emit('support:list', Array.from(supportSessions.values()).map(serializeSupportSession));
  });

  socket.on('support:message', (payload = {}) => {
    const conversationId = normalizeConversationId(payload.conversationId);
    if (!conversationId) return;

    const session = supportSessions.get(conversationId);
    if (!session) return;

    const text = sanitizeText(payload.text);
    const messageType = payload.messageType === 'audio' ? 'audio' : 'text';
    const audioUrl = messageType === 'audio' ? sanitizeAudioDataUrl(payload.audioUrl) : '';
    if (messageType === 'audio' && !audioUrl) return;
    if (messageType === 'text' && !text) return;

    const senderType = payload.senderType === 'admin' ? 'admin' : 'user';
    const senderName = sanitizeText(payload.senderName || (senderType === 'admin' ? 'Support Agent' : session.userName));
    const now = new Date().toISOString();
    const message = {
      id: `${conversationId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      senderType,
      senderName,
      messageType,
      text: messageType === 'text' ? text : '',
      audioUrl: messageType === 'audio' ? audioUrl : '',
      durationSec: messageType === 'audio' ? Math.min(60, Math.max(1, Number(payload.durationSec || 0) || 1)) : 0,
      createdAt: now,
    };

    session.messages.push(message);
    session.updatedAt = now;
    session.unreadForAdmin = senderType === 'user';

    io.to(supportRoom(conversationId)).emit('support:message', message);
    io.to('support_admins').emit('support:list', Array.from(supportSessions.values()).map(serializeSupportSession));
  });

  socket.on('disconnect', () => console.log('Socket disconnected:', socket.id));
});
