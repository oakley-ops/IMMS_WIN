const { executeWithRetry } = require('../../../db');
const { logger } = require('../../utils/logger');
const { lexicalSearch } = require('./lexicalSearch');
const { vectorSearch } = require('./vectorSearch');
const reranker = require('./reranker');
const { rrfFuse } = require('./rrf');

const CANDIDATES = 50; // per channel
const RERANK_POOL = 25; // fused candidates sent to the cross-encoder

async function hydrate(sourceIds, tenantId) {
  if (!sourceIds.length) return [];
  const { rows } = await executeWithRetry(
    `SELECT sd.source_id, sd.content, p.part_id, p.name, p.description,
            p.manufacturer_part_number, p.barcode, p.quantity, p.minimum_quantity,
            p.unit_cost, p.supplier, p.image_url,
            COALESCE(pl.name, p.location) AS location
     FROM search_documents sd
     JOIN parts p ON p.part_id = sd.source_id
     LEFT JOIN part_locations pl ON p.location_id = pl.location_id
     WHERE sd.tenant_id = $1 AND sd.source_type = 'part' AND sd.source_id = ANY($2)`,
    [tenantId, sourceIds]
  );
  const byId = new Map(rows.map((r) => [r.source_id, r]));
  return sourceIds.map((id) => byId.get(id)).filter(Boolean); // preserve fused order
}

// channels -> RRF -> cross-encoder rerank. Returns { ordered: hydrated rows (best first), degraded }.
async function rankCandidates({ q, tenantId }) {
  const degraded = [];
  const [lex, vec] = await Promise.all([
    lexicalSearch({ q, tenantId, limit: CANDIDATES }).catch((e) => {
      logger.error('search.lexical failed', { error: e.message });
      degraded.push('lexical');
      return [];
    }),
    vectorSearch({ q, tenantId, limit: CANDIDATES }).catch((e) => {
      logger.error('search.vector failed', { error: e.message });
      degraded.push('vector');
      return [];
    }),
  ]);

  const fusedIds = rrfFuse([lex, vec]).slice(0, RERANK_POOL).map((f) => f.source_id);
  let candidates = await hydrate(fusedIds, tenantId);

  if (q && candidates.length) {
    try {
      const scores = await reranker.score(q, candidates.map((c) => c.content));
      candidates = candidates
        .map((c, i) => ({ ...c, _rerank: scores[i] }))
        .sort((a, b) => b._rerank - a._rerank);
    } catch (e) {
      logger.error('search.rerank failed', { error: e.message });
      degraded.push('rerank'); // keep RRF order
    }
  }

  return { ordered: candidates, degraded: degraded.length ? degraded : null };
}

// Ordered part_id[] for a query (used by the Parts list to rank the table).
async function rankPartIds({ q, tenantId, limit = 25 }) {
  const { ordered, degraded } = await rankCandidates({ q, tenantId });
  return { ids: ordered.slice(0, limit).map((c) => c.part_id), degraded };
}

// Card-shaped results for GET /api/v1/search.
async function search({ q, tenantId, limit = 10 }) {
  const { ordered, degraded } = await rankCandidates({ q, tenantId });
  return {
    results: ordered.slice(0, limit).map((c) => ({
      part_id: c.part_id,
      name: c.name,
      description: c.description,
      manufacturer_part_number: c.manufacturer_part_number,
      barcode: c.barcode,
      quantity: c.quantity,
      minimum_quantity: c.minimum_quantity,
      unit_cost: c.unit_cost,
      supplier: c.supplier,
      image_url: c.image_url,
      location: c.location,
      citation: { type: 'part', id: c.part_id, href: `/parts/${c.part_id}` },
    })),
    degraded,
  };
}

module.exports = { search, rankPartIds };
