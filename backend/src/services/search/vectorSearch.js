const { executeWithRetry } = require('../../../db');
const { embed } = require('./embedder');
const { pgvectorAvailable } = require('./vectorMode');

// Semantic channel. Uses pgvector kNN (HNSW, cosine) when available; otherwise a
// brute-force cosine over real[] (vectors are L2-normalized, so cosine == dot product) —
// fine at small corpus sizes and lets the app run on a Postgres without pgvector.
async function vectorSearch({ q, tenantId, limit = 50 }) {
  const vec = await embed(q, { isQuery: true });

  if (await pgvectorAvailable()) {
    const vecLiteral = `[${vec.join(',')}]`;
    const { rows } = await executeWithRetry(
      `SELECT source_id
       FROM search_documents
       WHERE tenant_id = $2 AND source_type = 'part' AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vecLiteral, tenantId, limit]
    );
    return rows.map((r) => ({ source_id: r.source_id }));
  }

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
