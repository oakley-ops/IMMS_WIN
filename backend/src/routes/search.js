const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const roleAuthorization = require('../middleware/roleMiddleware');
const { currentTenantId } = require('../middleware/tenantScope');
const { logger } = require('../utils/logger');
const { search } = require('../services/search/searchService');

const ROLES_ALL = ['admin', 'tech', 'purchasing'];

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     summary: Hybrid search over parts (FTS + vector, RRF + cross-encoder rerank)
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text query (exact codes or fuzzy descriptions)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10, maximum: 50 }
 *     responses:
 *       200:
 *         description: Ranked parts with citations
 */
router.get('/', authenticateToken, roleAuthorization(ROLES_ALL), async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const tenantId = currentTenantId(req);
  if (!q) return res.json({ results: [], degraded: null, queryTimeMs: 0 });

  const start = Date.now();
  try {
    const { results, degraded } = await search({ q, tenantId, limit });
    const queryTimeMs = Date.now() - start;
    logger.info('search.query', { tenantId, q, count: results.length, degraded, queryTimeMs });
    res.json({ results, degraded, queryTimeMs });
  } catch (e) {
    logger.error('search.query failed', { tenantId, q, error: e.message });
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
