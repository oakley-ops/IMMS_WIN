require('dotenv').config();
const { Sentry, initSentry } = require('./src/observability/sentry');
const sentryEnabled = initSentry(); // before express so the SDK can instrument it
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const pinoHttp = require('pino-http');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const logger = require('./src/lib/logger');
const maintenanceCallsRouter = require('./src/routes/maintenanceCalls');
const callBoardLayoutsRouter = require('./src/routes/callBoardLayouts');
const permissionsRouter = require('./src/routes/permissions');
const analyticsRouter = require('./src/routes/analytics');

const app = express();
const server = http.createServer(app);

const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3003').split(',').map(s => s.trim());

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

global.io = io;

// ─── Middleware ───────────────────────────────────────────────────────────────

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));

// Structured request logging with a per-request correlation ID. The id is
// echoed to the client as `x-request-id` so a user-reported issue can be
// traced back to log lines.
app.use(
  pinoHttp({
    logger,
    genReqId: (req, res) => {
      const incoming = req.headers['x-request-id'];
      const id = (typeof incoming === 'string' && incoming.length <= 64)
        ? incoming
        : crypto.randomUUID();
      res.setHeader('x-request-id', id);
      return id;
    },
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
    serializers: {
      req: (req) => ({ id: req.id, method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  })
);

app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'healthy', service: 'MCS', timestamp: new Date().toISOString() }));

// Auth is owned by IMMS. MCS validates the JWT it issues but never logs users
// in directly. See maintenance_call_system/SCHEMA_CONTRACT.md.
app.use('/api/v1/maintenance-calls', maintenanceCallsRouter);
app.use('/api/v1/call-board-layouts', callBoardLayoutsRouter);
app.use('/api/v1/mcs/permissions', permissionsRouter);
app.use('/api/v1/mcs/analytics', analyticsRouter);

// ─── Error handler ────────────────────────────────────────────────────────────

if (sentryEnabled) Sentry.setupExpressErrorHandler(app);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Log full detail server-side via the request-scoped logger so the line is
  // tagged with the request id. Never echo err.message to the client.
  (req.log || logger).error({ err }, 'Unhandled error');
  const isDev = process.env.NODE_ENV !== 'production';
  const body = { error: 'server_error', message: 'Internal server error' };
  if (isDev) body.details = err.message;
  res.status(500).json(body);
});

app.use((req, res) =>
  res.status(404).json({ error: 'not_found', message: 'Not found' })
);

// ─── Socket.io ────────────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'Client connected');
  socket.on('disconnect', () => logger.info({ socketId: socket.id }, 'Client disconnected'));
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4001;
server.listen(PORT, '0.0.0.0', () => {
  logger.info({ port: PORT }, 'Backend running');
});
