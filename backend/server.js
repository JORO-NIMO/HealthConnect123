require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const compression = require('compression');
const morgan     = require('morgan');
const path       = require('path');
const { createServer } = require('http');
const { Server }       = require('socket.io');

const logger        = require('./utils/logger.util');
const routes        = require('./routes/index');
const { initializeDatabase } = require('./config/database');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const { auditMiddleware }        = require('./middleware/audit.middleware');
const { initCronJobs }           = require('./services/cron.service');

// ─── App & HTTP Server ─────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

// ─── Socket.IO for Real-Time Consultation ──────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Expose io to controllers
app.set('io', io);

// ─── Trust Proxy ──────────────────────────────────────────────────────────
// Required when running behind a reverse proxy / tunnel (VS Code Dev Tunnels,
// ngrok, nginx, etc.) so that express-rate-limit and IP detection work correctly.
app.set('trust proxy', 1);

// ─── Security & Utility Middleware ─────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Audit Logging ─────────────────────────────────────────────────────────
app.use('/api', auditMiddleware);

// ─── Static Frontend ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend'), {
  etag: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
  },
}));

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── Health Check ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    service: 'HealthConnect API',
  });
});

// ─── Serve Frontend SPA ────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ─── Error Handlers ────────────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ─── Socket.IO Event Handlers ──────────────────────────────────────────────
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Join consultation room
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-connected', userId);
    logger.info(`User ${userId} joined room ${roomId}`);
  });

  // Join user's personal notification channel
  socket.on('join-user', (userId) => {
    socket.join(`user:${userId}`);
    logger.info(`User ${userId} joined personal channel`);
  });

  // Chat messages
  socket.on('send-message', ({ roomId, message }) => {
    io.to(roomId).emit('receive-message', message);
  });

  // WebRTC signaling
  socket.on('webrtc-offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('webrtc-offer', offer);
  });
  socket.on('webrtc-answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('webrtc-answer', answer);
  });
  socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('webrtc-ice-candidate', candidate);
  });

  // Typing indicators
  socket.on('typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('user-typing', userId);
  });
  socket.on('stop-typing', ({ roomId, userId }) => {
    socket.to(roomId).emit('user-stop-typing', userId);
  });

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await initializeDatabase();

    // Initialize scheduled background jobs
    initCronJobs();

    httpServer.listen(PORT, () => {
      logger.info(`🚀 HealthConnect API running on port ${PORT}`);
      logger.info(`🌍 Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 Frontend    : ${process.env.FRONTEND_URL || 'http://localhost:' + PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
module.exports = { app, io };
