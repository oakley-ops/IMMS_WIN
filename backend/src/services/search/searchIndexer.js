const { executeWithRetry } = require('../../../db');
const { logger } = require('../../utils/logger');
const { embed } = require('./embedder');
const { buildPartContent, contentHash } = require('./partContent');
const { pgvectorAvailable } = require('./vectorMode');

const SOURCE = 'part';

// Selects one part with its location name, ready for buildPartContent.
const PART_SELECT = `
  SELECT p.part_id, p.name, p.description, p.manufacturer_part_number,
         p.barcode, p.supplier, p.notes, p.tenant_id,
         COALESCE(pl.name, p.location) AS location
  FROM parts p
  LEFT JOIN part_locations pl ON p.location_id = pl.location_id
  WHERE p.part_id = $1`;

async function indexPartById(partId) {
  const { rows } = await executeWithRetry(PART_SELECT, [partId]);
  if (!rows.length) return removePart(partId);
  const part = rows[0];
  const content = buildPartContent(part);
  const hash = contentHash(content);
  const tenantId = part.tenant_id ?? 1;

  const existing = await executeWithRetry(
    `SELECT content_hash FROM search_documents
     WHERE tenant_id=$1 AND source_type=$2 AND source_id=$3`,
    [tenantId, SOURCE, partId]
  );
  if (existing.rows[0] && existing.rows[0].content_hash === hash) return; // unchanged

  const vec = await embed(content);
  // pgvector wants a '[...]' literal cast to ::vector; a real[] column takes the JS array directly.
  const usePg = await pgvectorAvailable();
  const embeddingParam = usePg ? `[${vec.join(',')}]` : vec;
  const embeddingExpr = usePg ? '$5::vector' : '$5';

  await executeWithRetry(
    `INSERT INTO search_documents
       (tenant_id, source_type, source_id, content, tsv, embedding, content_hash, updated_at)
     VALUES ($1,$2,$3,$4, to_tsvector('english',$4), ${embeddingExpr}, $6, now())
     ON CONFLICT (tenant_id, source_type, source_id)
     DO UPDATE SET content=EXCLUDED.content, tsv=EXCLUDED.tsv,
                   embedding=EXCLUDED.embedding, content_hash=EXCLUDED.content_hash,
                   updated_at=now()`,
    [tenantId, SOURCE, partId, content, embeddingParam, hash]
  );
}

async function removePart(partId, tenantId = null) {
  const where = tenantId == null
    ? `source_type=$1 AND source_id=$2`
    : `tenant_id=$3 AND source_type=$1 AND source_id=$2`;
  const params = tenantId == null ? [SOURCE, partId] : [SOURCE, partId, tenantId];
  await executeWithRetry(`DELETE FROM search_documents WHERE ${where}`, params);
}

async function reindexAll(tenantId = 1) {
  const { rows } = await executeWithRetry(
    `SELECT part_id FROM parts WHERE tenant_id=$1 AND COALESCE(status,'active')='active'`,
    [tenantId]
  );
  let n = 0;
  for (const r of rows) {
    try {
      await indexPartById(r.part_id);
      n++;
    } catch (e) {
      logger.error('search.reindex part failed', { partId: r.part_id, error: e.message });
    }
  }
  return n;
}

module.exports = { indexPartById, removePart, reindexAll };
