// src/app.js
const crypto = require('crypto');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');

const logger = require('./lib/logger');
const errorHandler = require('./middleware/errorHandler');
const authRouter = require('./routes/auth');
const adminUsersRouter = require('./routes/adminUsers');

const buildApp = () => {
  const app = express();
  const CORS_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',').map((s) => s.trim());

  app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(pinoHttp({
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
  }));
  app.use(cors({
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 50, standardHeaders: true, legacyHeaders: false }));
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 2000, standardHeaders: true, legacyHeaders: false }));

  app.get('/health', (req, res) =>
    res.json({ status: 'healthy', service: 'auth', timestamp: new Date().toISOString() })
  );

  app.use('/auth', authRouter);
  app.use('/admin/users', adminUsersRouter);

  app.use((req, res) =>
    res.status(404).json({ error: 'not_found', message: 'Not found' })
  );

  app.use(errorHandler);

  return app;
};

module.exports = buildApp;
