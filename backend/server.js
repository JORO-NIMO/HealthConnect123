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
const { passport }  = require('./config/passport');
const { initializeDatabase } = require('./config/database');
const { ensureSchema }       = require('./database/ensureSchema');
const { runMigrations }      = require('./database/autoMigrate');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const { auditMiddleware }        = require('./middleware/audit.middleware');
const { initCronJobs }           = require('./services/cron.service');

// ─── App & HTTP Server ─────────────────────────────────────────────────────
const app        = express();
const httpServer = createServer(app);

// ─── CORS Origin Helper ────────────────────────────────────────────────────
// Dynamically allow the requesting origin so it works on localhost, Railway,
// and custom domains without manual FRONTEND_URL configuration.
function resolveCorsOrigin() {
  const envUrl = process.env.FRONTEND_URL;
  // If explicitly set to specific URLs (not wildcard), use those
  if (envUrl && envUrl !== '*') {
    return envUrl.split(',').map(u => u.trim());
  }
  // Otherwise, reflect the requesting origin (works with credentials)
  return true;
}

// ─── Socket.IO for Real-Time Consultation ──────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: resolveCorsOrigin(),
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
app.use(cors({
  origin: resolveCorsOrigin(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(passport.initialize());
app.use(morgan('combined', {
  stream: { write: (msg) => logger.info(msg.trim()) },
}));

// ─── Audit Logging ─────────────────────────────────────────────────────────
app.use('/api', auditMiddleware);

// ─── Static Frontend ───────────────────────────────────────────────────────
const fs = require('fs');
const FRONTEND_DIR   = path.join(__dirname, '../frontend');
const FRONTEND_INDEX = path.join(FRONTEND_DIR, 'index.html');
const hasFrontend    = fs.existsSync(FRONTEND_INDEX);
const ROOT_LOGO_PATH = path.join(__dirname, '../logo.jpeg');
const FRONTEND_IMAGES_DIR = path.join(FRONTEND_DIR, 'images');
const FRONTEND_LOGO_PATH = path.join(FRONTEND_IMAGES_DIR, 'logo.jpeg');

function resolveLogoPath() {
  if (fs.existsSync(FRONTEND_LOGO_PATH)) return FRONTEND_LOGO_PATH;
  if (fs.existsSync(ROOT_LOGO_PATH)) return ROOT_LOGO_PATH;
  return null;
}

if (hasFrontend) {
  // Keep logo available from static frontend path across deploys
  if (fs.existsSync(ROOT_LOGO_PATH) && !fs.existsSync(FRONTEND_LOGO_PATH)) {
    try {
      fs.mkdirSync(FRONTEND_IMAGES_DIR, { recursive: true });
      fs.copyFileSync(ROOT_LOGO_PATH, FRONTEND_LOGO_PATH);
      logger.info('✅ Synced logo.jpeg to frontend/images/logo.jpeg');
    } catch (err) {
      logger.warn(`⚠️  Could not sync logo.jpeg into frontend/images: ${err.message}`);
    }
  }

  app.get(['/images/logo.jpeg', '/logo.jpeg', '/favicon.ico'], (req, res, next) => {
    const logoPath = resolveLogoPath();
    if (!logoPath) return next();

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/jpeg');
    return res.sendFile(logoPath);
  });

  // Serve sw.js with aggressive no-cache so browsers always fetch the latest version
  app.get('/sw.js', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(FRONTEND_DIR, 'sw.js'));
  });

  app.use(express.static(FRONTEND_DIR, {
    etag: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
      }
    },
  }));
} else {
  logger.warn('⚠️  Frontend directory not found at ' + FRONTEND_DIR);
  logger.warn('   If running on Railway, set Root Directory to "/" (repo root), not "backend/"');
}

// ─── API Routes ────────────────────────────────────────────────────────────
app.use('/api/v1', routes);

// ─── Health checks at /api root for Railway/K8s compatibility ──────────────
const healthRoutes = require('./routes/health.routes');
app.use('/api', healthRoutes);

// ─── Serve Frontend SPA ────────────────────────────────────────────────────
if (hasFrontend) {
  app.get('*', (req, res) => {
    res.sendFile(FRONTEND_INDEX);
  });
}

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

// ─── Startup Diagnostics ───────────────────────────────────────────────────
function logEnvDiagnostics() {
  const vars = {
    'NODE_ENV'       : process.env.NODE_ENV,
    'PORT'           : process.env.PORT,
    'MYSQL_URL'      : process.env.MYSQL_URL      ? '✅ SET' : '❌ NOT SET',
    'DATABASE_URL'   : process.env.DATABASE_URL    ? '✅ SET' : '❌ NOT SET',
    'DB_HOST'        : process.env.DB_HOST         || '(not set, defaults to localhost)',
    'JWT_SECRET'     : process.env.JWT_SECRET      ? '✅ SET' : '❌ NOT SET — auth will fail!',
    'JWT_REFRESH_SECRET': process.env.JWT_REFRESH_SECRET ? '✅ SET' : '❌ NOT SET',
    'ENCRYPTION_KEY' : process.env.ENCRYPTION_KEY  ? '✅ SET' : '⚠️  NOT SET',
    'AI_PROVIDER'    : process.env.AI_PROVIDER     || '(defaults to huggingface)',
    'HF_TOKEN'       : process.env.HF_TOKEN        ? '✅ SET' : '❌ NOT SET — AI disabled',
    'FRONTEND_URL'   : process.env.FRONTEND_URL    || '(auto-detect from request origin)',
    'GOOGLE_CLIENT_ID': process.env.GOOGLE_CLIENT_ID
      ? (process.env.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com') ? '✅ SET' : '⚠️  INVALID FORMAT')
      : '❌ NOT SET',
    'GOOGLE_CLIENT_SECRET': process.env.GOOGLE_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET',
    'GOOGLE_CALLBACK_URL': process.env.GOOGLE_CALLBACK_URL || '❌ NOT SET',
  };
  logger.info('🔧 Environment Variable Diagnostics:');
  for (const [key, val] of Object.entries(vars)) {
    logger.info(`   ${key}: ${val}`);
  }

  // Warn about critical missing vars
  if (!process.env.MYSQL_URL && !process.env.DATABASE_URL && !process.env.DB_HOST) {
    logger.error('🚨 No database connection configured! Set MYSQL_URL (Railway plugin) or DB_HOST/DB_USER/DB_PASSWORD/DB_NAME');
  }
  if (!process.env.JWT_SECRET) {
    logger.error('🚨 JWT_SECRET is not set — all authenticated API requests will fail with 401!');
  }
  if (!process.env.HF_TOKEN && !process.env.OPENAI_API_KEY) {
    logger.error('🚨 No AI token configured — AI symptom analysis will be unavailable');
  }
}

async function startServer() {
  // Bind to port FIRST — Railway health checks must get a response immediately.
  // DB init happens after, so a slow/misconfigured DB never causes a 502.
  await new Promise((resolve, reject) => {
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 HealthConnect API running on port ${PORT}`);
      logger.info(`🌍 Environment : ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 Frontend    : auto-detected from request origin`);
      logEnvDiagnostics();
      resolve();
    });
    httpServer.on('error', reject);
  });

  // Now connect to DB in the background — server stays up even if DB is slow.
  try {
    logger.info('🔄 Starting database initialization...');
    await initializeDatabase();
    logger.info('✅ Database connected');
    
    logger.info('🔄 Ensuring schema...');
    await ensureSchema();
    logger.info('✅ Schema verified');
    
    logger.info('🔄 Running migrations...');
    await runMigrations();
    logger.info('✅ Migrations complete');
    
    logger.info('🔄 Starting cron jobs...');
    initCronJobs();
    logger.info('✅ Cron jobs started');
    
    logger.info('✅ Database connected, schema verified, cron jobs started');
  } catch (err) {
    logger.error('⚠️  Database initialisation failed — API is up but DB calls will fail:', err.message);
    logger.error('Stack trace:', err.stack);
    // Do NOT exit — let Railway keep the container alive so it can reconnect
    // after the DB plugin finishes provisioning.
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
  logger.error('Unhandled Rejection at:', JSON.stringify(promise));
  logger.error('Reason type:', typeof reason);
  logger.error('Reason:', JSON.stringify(reason, null, 2));
  if (reason instanceof Error) {
    logger.error('Error message:', reason.message);
    logger.error('Stack trace:', reason.stack);
  }
  gracefulShutdown('UNHANDLED_REJECTION');
});

startServer().catch(err => {
  logger.error('Fatal startup error:', err);
  process.exit(1);
});
module.exports = { app, io };

