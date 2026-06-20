const { executeWithRetry } = require('../../../db');
const { embed } = require('./embedder');

// Semantic channel: pgvector kNN over the embedding column (HNSW, cosine distance).
async function vectorSearch({ q, tenantId, limit = 50 }) {
  const vec = await embed(q, { isQuery: true });
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

module.exports = { vectorSearch };
