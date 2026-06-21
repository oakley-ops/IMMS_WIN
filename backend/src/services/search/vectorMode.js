const { executeWithRetry } = require('../../../db');

// Detect once (per process) whether pgvector is installed. Used to choose between
// vector(384) + HNSW kNN (when available) and a real[] brute-force cosine fallback.
let cached = null;

async function pgvectorAvailable() {
  if (cached !== null) return cached;
  try {
    const { rows } = await executeWithRetry(
      `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS has`,
      []
    );
    cached = !!(rows[0] && rows[0].has);
  } catch (e) {
    cached = false;
  }
  return cached;
}

// test helper
function _resetCache() {
  cached = null;
}

module.exports = { pgvectorAvailable, _resetCache };
