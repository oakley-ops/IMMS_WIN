// src/routes/auth.js
const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth, COOKIE_NAME } = require('../middleware/auth');
const { loginSchema } = require('../schemas/auth');
const authService = require('../services/authService');
const { TTL_SECONDS } = require('../lib/jwt');
const db = require('../database');

const router = express.Router();

const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure:   process.env.COOKIE_SECURE === 'true',
  domain:   process.env.COOKIE_DOMAIN || undefined,
  maxAge:   TTL_SECONDS * 1000,
  path:     '/',
});

const handler = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

router.post('/login', validate({ body: loginSchema }), handler(async (req, res) => {
  const { token, user } = await authService.login(db, req.body);
  res.cookie(COOKIE_NAME, token, cookieOpts());
  res.json({ user });
}));

router.post('/logout', handler(async (req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOpts(), maxAge: undefined });
  res.json({ ok: true });
}));

router.get('/me', requireAuth, handler(async (req, res) => {
  const user = await authService.me(db, req.user);
  res.json({ user });
}));

router.post('/refresh', requireAuth, handler(async (req, res) => {
  const { token, user } = await authService.refresh(db, req.user);
  res.cookie(COOKIE_NAME, token, cookieOpts());
  res.json({ user });
}));

module.exports = router;
