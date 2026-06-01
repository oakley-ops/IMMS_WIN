// backend/src/routes/demoRoutes.js
const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const requireDemoMode = require('../middleware/requireDemoMode');
const auth = require('../middleware/auth');
const db = require('../../db');
const { execSync } = require('child_process');
const path = require('path');

const VALID_ROLES = ['admin', 'purchaser', 'viewer'];
const DEMO_USERNAMES = {
  admin: 'demo-admin',
  purchaser: 'demo-purchaser',
  viewer: 'demo-viewer',
};

// GET /api/v1/demo/config
router.get('/config', requireDemoMode, (req, res) => {
  res.json({ demoMode: true, roles: VALID_ROLES });
});

// POST /api/v1/demo/login?role=admin|purchaser|viewer
router.post('/login', requireDemoMode, async (req, res) => {
  const { role } = req.query;
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
  }
  try {
    const username = DEMO_USERNAMES[role];
    const result = await db.query(
      'SELECT user_id, username, role FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];
    if (!user) {
      return res.status(500).json({ message: 'Demo user not found — run seed:demo first' });
    }
    const token = jwt.sign(
      { id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.user_id, username: user.username, role: user.role } });
  } catch (err) {
    console.error('Demo login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/v1/demo/reset  (admin only)
router.post('/reset', requireDemoMode, auth, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Only demo-admin can reset the demo' });
  }
  try {
    console.log('[Demo] Reset triggered by', req.user.username);
    execSync(`node ${path.join(__dirname, '../scripts/seedDemo.js')}`, {
      stdio: 'inherit',
      env: { ...process.env },
    });
    res.json({ message: 'Demo reset complete' });
  } catch (err) {
    console.error('[Demo] Reset failed:', err);
    res.status(500).json({ message: 'Reset failed', detail: err.message });
  }
});

// GET /api/v1/demo/sent-emails
router.get('/sent-emails', requireDemoMode, auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, po_number, recipient, subject, created_at FROM demo_sent_emails ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/v1/demo/sent-emails/:id
router.get('/sent-emails/:id', requireDemoMode, auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM demo_sent_emails WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
