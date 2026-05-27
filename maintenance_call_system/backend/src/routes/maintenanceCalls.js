const express = require('express');
const router = express.Router();
const db = require('../database/db');
const logger = require('../lib/logger');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { errors } = require('../middleware/errors');
const S = require('../schemas/maintenanceCalls');
const repo = require('../repositories/maintenanceCallsRepo');
const { handleBadgeSwipe, DomainError } = require('../services/badgeSwipeService');

const log = (req) => req.log || logger;

const emit = (event, payload) => {
  if (global.io) global.io.emit(event, payload);
};

// Wraps an async handler so thrown errors flow into a single catch block.
const handler = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err instanceof DomainError) {
    if (err.status === 404) return errors.notFound(res, err.message);
    if (err.status === 409) return errors.conflict(res, err.message);
    return errors.badRequest(res, err.message);
  }
  log(req).error({ err }, 'Route error');
  return errors.serverError(res);
});

// ─── Badge Swipe — public, no auth (called from kiosk) ──────────────────────

router.post(
  '/badge-swipe',
  validate({ body: S.badgeSwipeBody }),
  handler(async (req, res) => {
    const result = await handleBadgeSwipe(db, req.body);
    if (result.emit) emit(result.emit.event, result.emit.payload);
    const { emit: _e, ...body } = result;
    return res.json(body);
  })
);

// ─── Active calls — public (call board) ─────────────────────────────────────

router.get(
  '/active',
  handler(async (req, res) => res.json(await repo.listActiveCalls(db)))
);

// ─── Board status — public (per-machine derived status for the TV board) ───

router.get(
  '/board-status',
  handler(async (req, res) => res.json(await repo.getBoardStatus(db)))
);

// ─── Reader info — public (kiosk) ───────────────────────────────────────────

router.get(
  '/reader/:reader_key',
  handler(async (req, res) => {
    const reader = await repo.findActiveReader(db, req.params.reader_key);
    if (!reader) return errors.notFound(res, 'Reader not found');
    return res.json(reader);
  })
);

// ─── Parts search — must come BEFORE /:id ───────────────────────────────────

router.get(
  '/parts/search',
  validate({ query: S.partsSearchQuery }),
  handler(async (req, res) => {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    return res.json(await repo.searchParts(db, q));
  })
);

// ─── Metrics — auth required ────────────────────────────────────────────────

router.get(
  '/stats/metrics',
  auth,
  validate({ query: S.metricsQuery }),
  handler(async (req, res) => res.json(await repo.callMetrics(db, req.query)))
);

// ─── Parts metrics — auth required ──────────────────────────────────────────

router.get(
  '/stats/parts-metrics',
  auth,
  validate({ query: S.partsMetricsQuery }),
  handler(async (req, res) => res.json(await repo.partsMetrics(db, req.query)))
);

// ─── Call history — auth required ───────────────────────────────────────────

router.get(
  '/',
  auth,
  validate({ query: S.callListQuery }),
  handler(async (req, res) => res.json(await repo.listCalls(db, req.query)))
);

// ─── Single call ────────────────────────────────────────────────────────────

router.get(
  '/:id',
  auth,
  validate({ params: S.idParam }),
  handler(async (req, res) => {
    const call = await repo.findCallById(db, req.params.id);
    if (!call) return errors.notFound(res, 'Call not found');
    return res.json(call);
  })
);

// ─── Resolve call ───────────────────────────────────────────────────────────

router.put(
  '/:id/resolve',
  validate({ params: S.idParam, body: S.resolveBody }),
  handler(async (req, res) => {
    const updated = await repo.resolveCall(db, {
      callId: req.params.id,
      reasonCategory: req.body.reason_category || null,
      resolutionNotes: req.body.resolution_notes,
      problemDescription: req.body.problem_description || null,
    });
    if (!updated) return errors.notFound(res, 'Call not found or already resolved');
    emit('maintenance_call_resolved', updated);
    return res.json(updated);
  })
);

// ─── Suspend call ───────────────────────────────────────────────────────────

router.put(
  '/:id/suspend',
  validate({ params: S.idParam, body: S.suspendBody }),
  handler(async (req, res) => {
    const updated = await repo.suspendCall(db, {
      callId: req.params.id,
      suspensionNotes: req.body.suspension_notes || null,
    });
    if (!updated) return errors.notFound(res, 'Call not found or not in progress');
    emit('maintenance_call_updated', updated);
    return res.json(updated);
  })
);

// ─── Resume a suspended call ────────────────────────────────────────────────

router.put(
  '/:id/resume',
  validate({ params: S.idParam }),
  handler(async (req, res) => {
    const updated = await repo.resumeCallById(db, req.params.id);
    if (!updated) return errors.notFound(res, 'Call not found or not suspended');
    emit('maintenance_call_updated', updated);
    return res.json(updated);
  })
);

// ─── Log parts used on a call ───────────────────────────────────────────────

router.post(
  '/:id/parts',
  validate({ params: S.idParam, body: S.logPartsBody }),
  handler(async (req, res) =>
    res.json(await repo.insertCallParts(db, req.params.id, req.body.parts))
  )
);

router.get(
  '/:id/parts',
  validate({ params: S.idParam }),
  handler(async (req, res) =>
    res.json(await repo.listCallParts(db, req.params.id))
  )
);

// ─── Badge admin ────────────────────────────────────────────────────────────

router.get('/admin/badges', auth, handler(async (req, res) =>
  res.json(await repo.listBadges(db))
));

router.post(
  '/admin/badges',
  auth,
  validate({ body: S.createBadgeBody }),
  handler(async (req, res) => res.status(201).json(await repo.upsertBadge(db, req.body)))
);

router.put(
  '/admin/badges/:badge_id',
  auth,
  validate({ body: S.updateBadgeBody }),
  handler(async (req, res) => {
    const updated = await repo.updateBadge(db, req.params.badge_id, req.body);
    if (!updated) return errors.notFound(res, 'Badge not found');
    return res.json(updated);
  })
);

// ─── Reader admin ───────────────────────────────────────────────────────────

router.get('/admin/readers', auth, handler(async (req, res) =>
  res.json(await repo.listReaders(db))
));

router.post(
  '/admin/readers',
  auth,
  validate({ body: S.createReaderBody }),
  (req, res) => repo.insertReader(db, req.body)
    .then((reader) => res.status(201).json(reader))
    .catch((err) => {
      if (err.code === '23505') return errors.conflict(res, 'reader_key already exists');
      log(req).error({ err }, 'Reader create error');
      return errors.serverError(res);
    })
);

router.put(
  '/admin/readers/:id',
  auth,
  validate({ params: S.idParam, body: S.updateReaderBody }),
  handler(async (req, res) => {
    const updated = await repo.updateReader(db, req.params.id, req.body);
    if (!updated) return errors.notFound(res, 'Reader not found');
    return res.json(updated);
  })
);

router.get('/machines/list', auth, handler(async (req, res) =>
  res.json(await repo.listActiveMachines(db))
));

module.exports = router;
