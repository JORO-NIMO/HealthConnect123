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
    origin: process.env.FRONTEND_URL 
      ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
      : '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
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

// ─── CORS Configuration ───────────────────────────────────────────────────
const corsOrigins = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : '*';

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
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

// ─── Health checks at /api root for Railway/K8s compatibility ──────────────
const healthRoutes = require('./routes/health.routes');
app.use('/api', healthRoutes);

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

  // Error handler for socket
  socket.on('error', (error) => {
    logger.error(`Socket error ${socket.id}:`, error);
  });

  // Join consultation room
  socket.on('join-room', (roomId, userId) => {
    try {
      socket.join(roomId);
      socket.to(roomId).emit('user-connected', userId);
      logger.info(`User ${userId} joined room ${roomId}`);
    } catch (err) {
      logger.error('Error joining room:', err);
      socket.emit('error', { message: 'Failed to join room' });
    }
  });

  // Join user's personal notification channel
  socket.on('join-user', (userId) => {
    try {
      socket.join(`user:${userId}`);
      logger.info(`User ${userId} joined personal channel`);
    } catch (err) {
      logger.error('Error joining user channel:', err);
      socket.emit('error', { message: 'Failed to join user channel' });
    }
  });

  // Chat messages
  socket.on('send-message', ({ roomId, message }) => {
    try {
      io.to(roomId).emit('receive-message', message);
    } catch (err) {
      logger.error('Error sending message:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // WebRTC signaling
  socket.on('webrtc-offer', ({ roomId, offer }) => {
    try {
      socket.to(roomId).emit('webrtc-offer', offer);
    } catch (err) {
      logger.error('Error sending WebRTC offer:', err);
    }
  });
  socket.on('webrtc-answer', ({ roomId, answer }) => {
    try {
      socket.to(roomId).emit('webrtc-answer', answer);
    } catch (err) {
      logger.error('Error sending WebRTC answer:', err);
    }
  });
  socket.on('webrtc-ice-candidate', ({ roomId, candidate }) => {
    try {
      socket.to(roomId).emit('webrtc-ice-candidate', candidate);
    } catch (err) {
      logger.error('Error sending ICE candidate:', err);
    }
  });

  // Typing indicators
  socket.on('typing', ({ roomId, userId }) => {
    try {
      socket.to(roomId).emit('user-typing', userId);
    } catch (err) {
      logger.error('Error sending typing indicator:', err);
    }
  });
  socket.on('stop-typing', ({ roomId, userId }) => {
    try {
      socket.to(roomId).emit('user-stop-typing', userId);
    } catch (err) {
      logger.error('Error sending stop-typing indicator:', err);
    }
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

// ─── Graceful Shutdown ─────────────────────────────────────────────────────
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  httpServer.close(() => {
    logger.info('HTTP server closed');
  });

  // Close Socket.IO connections
  io.close(() => {
    logger.info('Socket.IO connections closed');
  });

  // Give ongoing requests time to complete
  setTimeout(() => {
    logger.info('Forcing shutdown after timeout');
    process.exit(0);
  }, 30000); // 30 seconds timeout
};

// Handle termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer();
module.exports = { app, io };

