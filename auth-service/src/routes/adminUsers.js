// src/routes/adminUsers.js
const express = require('express');
const validate = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const { createUserSchema, updateUserSchema, idParamsSchema } = require('../schemas/adminUsers');
const usersService = require('../services/usersService');
const db = require('../database');

const router = express.Router();

const handler = (fn) => async (req, res, next) => {
  try { await fn(req, res, next); } catch (err) { next(err); }
};

const adminOnly = [requireAuth, requireRole('imms.admin', 'mcs.admin')];

router.get('/', ...adminOnly, handler(async (req, res) => {
  const users = await usersService.list(db, req.user.tenant_id);
  res.json({ users });
}));

router.get('/:userId',
  ...adminOnly,
  validate({ params: idParamsSchema }),
  handler(async (req, res) => {
    const user = await usersService.get(db, req.user.tenant_id, req.params.userId);
    res.json({ user });
  })
);

router.post('/',
  ...adminOnly,
  validate({ body: createUserSchema }),
  handler(async (req, res) => {
    const user = await usersService.create(db, req.user.tenant_id, req.body);
    res.status(201).json({ user });
  })
);

router.put('/:userId',
  ...adminOnly,
  validate({ params: idParamsSchema, body: updateUserSchema }),
  handler(async (req, res) => {
    const user = await usersService.update(db, req.user.tenant_id, req.params.userId, req.body);
    res.json({ user });
  })
);

module.exports = router;
