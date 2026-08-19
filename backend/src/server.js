require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');

const logger = require('./logger');
const db = require('./db/db');
const { isDefaultSecret } = require('./services/auth');
const authRoutes = require('./routes/auth');
const emergencyRoutes = require('./routes/emergencies');
const responderRoutes = require('./routes/responders');
const analyticsRoutes = require('./routes/analytics');
const orgRoutes = require('./routes/organizations');
const notificationRoutes = require('./routes/notifications');
const { setBroadcaster } = require('./services/notification');

// A guessable JWT secret means anyone can forge a valid session token for
// any user, including admins — this is not survivable in a real
// deployment, so refuse to boot rather than run insecurely by default.
if (isDefaultSecret() && process.env.NODE_ENV === 'production') {
  logger.error('JWT_SECRET is unset or still the default value. Refusing to start in production. Set a long random JWT_SECRET.');
  process.exit(1);
} else if (isDefaultSecret()) {
  logger.warn('JWT_SECRET is using the insecure default. Fine for local dev, but set a real secret before deploying.');
}

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  // The API also serves the built SPA (see frontendDist below); a default
  // strict CSP would block Leaflet's inline styles and the Google Fonts
  // link the frontend uses, so it's relaxed rather than disabled outright.
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://*.tile.openstreetmap.org'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'ws:', 'wss:'],
    },
  },
}));

const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean);
app.use(cors(corsOrigins.length > 0 ? { origin: corsOrigins } : {}));

app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));
app.use(express.json({ limit: '1mb' }));

// Abuse protection: report submission and auth endpoints are the public,
// unauthenticated attack surface. Dashboard GETs stay unrestricted.
const reportLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
app.post('/api/emergencies', reportLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait before trying again.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/refresh', authLimiter);

app.get('/api/health', (req, res) => {
  try {
    db.prepare('SELECT 1').get();
    res.json({ status: 'ok', service: 'afriresq-api', db: 'ok', time: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', service: 'afriresq-api', db: 'unreachable', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/responders', responderRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/notifications', notificationRoutes);

const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
}

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  (req.log || logger).error({ err }, 'unhandled request error');
  res.status(500).json({ error: 'Internal server error' });
});

if (fs.existsSync(frontendDist)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Live dashboard feed: coordinators' dashboards subscribe over WebSocket and
// receive a push the instant a new emergency/notification/status change
// happens, instead of polling (SRS FR-3.7).
const wss = new WebSocketServer({ server, path: '/ws' });
function broadcast(payload) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}
setBroadcaster(broadcast);
wss.on('connection', (ws) => ws.send(JSON.stringify({ type: 'connected' })));

function shutdown(signal) {
  logger.info({ signal }, 'shutting down');
  wss.clients.forEach((client) => client.close());
  server.close(() => {
    try {
      db.close();
    } catch (_) {
      /* already closed */
    }
    logger.info('shutdown complete');
    process.exit(0);
  });
  // Force-exit if connections don't drain in time.
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error({ err }, 'uncaught exception');
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled promise rejection');
  process.exit(1);
});

// Only bind a port when run directly — importing `app` for tests (see
// tests/api.test.js) must not also start listening.
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    logger.info(`AfriResQ API listening on port ${PORT}`);
    try {
      const users = db.prepare('SELECT COUNT(*) as c FROM users').get();
      if (users.c === 0) {
        require('./db/bootstrap-admin').bootstrapAdmin();
      }
    } catch (err) {
      logger.error({ err }, 'admin bootstrap on boot failed');
    }
  });
}

module.exports = { app, server };
