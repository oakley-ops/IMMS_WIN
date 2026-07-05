const express = require('express');
const router = express.Router();
const db = require('../database/db');
const logger = require('../lib/logger');
const auth = require('../middleware/auth');
const validate = require('../middleware/validate');
const { errors } = require('../middleware/errors');
const S = require('../schemas/callBoardLayouts');
const repo = require('../repositories/callBoardLayoutsRepo');
const { captureException } = require('../observability/sentry');

const log = (req) => req.log || logger;

const emit = (event, payload) => {
  if (global.io) global.io.emit(event, payload);
};

const handler = (fn) => (req, res) => fn(req, res).catch((err) => {
  log(req).error({ err }, 'Layouts route error');
  captureException(err);
  return errors.serverError(res);
});

// Run a function inside a Postgres transaction, passing the client as the `db`
// argument so repo functions (which expect a db-like interface) reuse the
// connection.
const withTx = async (fn) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ─── List all layouts (public) ──────────────────────────────────────────────

router.get(
  '/',
  handler(async (req, res) => res.json(await repo.listLayouts(db)))
);

// ─── Default layout with tiles (public — TV display uses this on boot) ──────
// Registered before /:id so 'default' isn't captured as a param.

router.get(
  '/default/current',
  handler(async (req, res) => {
    const layout = await repo.findDefaultLayout(db);
    if (!layout) return res.json(null);
    const tiles = await repo.listTilesForLayout(db, layout.layout_id);
    return res.json({ ...layout, tiles });
  })
);

// ─── One layout with tiles (public) ─────────────────────────────────────────

router.get(
  '/:id',
  validate({ params: S.idParam }),
  handler(async (req, res) => {
    const layout = await repo.findLayoutById(db, req.params.id);
    if (!layout) return errors.notFound(res, 'Layout not found');
    const tiles = await repo.listTilesForLayout(db, layout.layout_id);
    return res.json({ ...layout, tiles });
  })
);

// ─── Create layout (auth) ───────────────────────────────────────────────────

router.post(
  '/',
  auth,
  validate({ body: S.createLayoutBody }),
  handler(async (req, res) => {
    const { name, orientation, grid_cols, grid_rows, is_default } = req.body;
    const created = await withTx(async (tx) => {
      if (is_default) await repo.clearDefaultFlag(tx);
      return repo.insertLayout(tx, {
        name, orientation,
        gridCols: grid_cols, gridRows: grid_rows,
        isDefault: is_default,
      });
    });
    emit('call_board_layout_updated', { layout_id: created.layout_id });
    return res.status(201).json({ ...created, tiles: [] });
  })
);

// ─── Update layout metadata (auth) ──────────────────────────────────────────

router.put(
  '/:id',
  auth,
  validate({ params: S.idParam, body: S.updateLayoutBody }),
  handler(async (req, res) => {
    const id = req.params.id;
    const { name, orientation, grid_cols, grid_rows, is_default } = req.body;
    const updated = await withTx(async (tx) => {
      if (is_default === true) await repo.clearDefaultFlag(tx, id);
      return repo.updateLayoutMeta(tx, id, {
        name, orientation,
        gridCols: grid_cols, gridRows: grid_rows,
        isDefault: is_default,
      });
    });
    if (!updated) return errors.notFound(res, 'Layout not found');
    emit('call_board_layout_updated', { layout_id: updated.layout_id });
    return res.json(updated);
  })
);

// ─── Delete layout (auth) ───────────────────────────────────────────────────

router.delete(
  '/:id',
  auth,
  validate({ params: S.idParam }),
  handler(async (req, res) => {
    const deleted = await repo.deleteLayout(db, req.params.id);
    if (!deleted) return errors.notFound(res, 'Layout not found');
    emit('call_board_layout_updated', { layout_id: Number(req.params.id), deleted: true });
    return res.json({ deleted: deleted.layout_id });
  })
);

// ─── Bulk replace tiles for a layout (auth) ─────────────────────────────────

router.put(
  '/:id/tiles',
  auth,
  validate({ params: S.idParam, body: S.saveTilesBody }),
  handler(async (req, res) => {
    const id = req.params.id;
    const result = await withTx(async (tx) => {
      const layout = await repo.findLayoutById(tx, id);
      if (!layout) return null;
      await repo.replaceLayoutTiles(tx, id, req.body.tiles);
      return repo.listTilesForLayout(tx, id);
    });
    if (result === null) return errors.notFound(res, 'Layout not found');
    emit('call_board_layout_updated', { layout_id: Number(id) });
    return res.json({ layout_id: Number(id), tiles: result });
  })
);

module.exports = router;
