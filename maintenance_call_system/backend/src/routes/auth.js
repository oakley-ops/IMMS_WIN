const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const logger = require('../lib/logger');
const validate = require('../middleware/validate');
const { errors } = require('../middleware/errors');
const { loginBody } = require('../schemas/auth');

router.post('/login', validate({ body: loginBody }), async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await db.query(
      'SELECT user_id, username, password_hash, role FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return errors.unauthorized(res, 'Invalid credentials');
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return errors.unauthorized(res, 'Invalid credentials');
    }

    const token = jwt.sign(
      { id: user.user_id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.user_id, username: user.username, role: user.role },
    });
  } catch (err) {
    (req.log || logger).error({ err }, 'Login error');
    return errors.serverError(res, 'Login failed');
  }
});

module.exports = router;
