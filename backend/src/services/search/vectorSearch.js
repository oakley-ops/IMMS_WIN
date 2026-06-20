const { executeWithRetry } = require('../../../db');
const { embed } = require('./embedder');

// Brute-force cosine over real[] embeddings. Vectors are L2-normalized, so
// cosine == dot product. Fine at this corpus size; swap to pgvector kNN later.
async function vectorSearch({ q, tenantId, limit = 50 }) {
  const vec = await embed(q, { isQuery: true });
  const { rows } = await executeWithRetry(
    `SELECT source_id,
            (SELECT COALESCE(sum(a * b), 0)
               FROM unnest(embedding, $1::real[]) AS t(a, b)) AS sim
     FROM search_documents
     WHERE tenant_id = $2 AND source_type = 'part' AND embedding IS NOT NULL
     ORDER BY sim DESC
     LIMIT $3`,
    [vec, tenantId, limit]
  );
  return rows.map((r) => ({ source_id: r.source_id }));
}

module.exports = { vectorSearch };
