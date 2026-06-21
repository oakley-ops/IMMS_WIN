const { executeWithRetry } = require('../../../db');

// FTS over the indexed content + trigram/substring fuzzy match on the part code columns.
async function lexicalSearch({ q, tenantId, limit = 50 }) {
  const { rows } = await executeWithRetry(
    `SELECT sd.source_id,
            ts_rank_cd(sd.tsv, plainto_tsquery('english', $1))
              + GREATEST(
                  similarity(coalesce(p.manufacturer_part_number, ''), $1),
                  similarity(coalesce(p.barcode, ''), $1)
                ) AS rank
     FROM search_documents sd
     JOIN parts p ON p.part_id = sd.source_id
     WHERE sd.tenant_id = $2
       AND sd.source_type = 'part'
       AND ( sd.tsv @@ plainto_tsquery('english', $1)
             OR p.manufacturer_part_number ILIKE '%' || $1 || '%'
             OR p.barcode ILIKE '%' || $1 || '%' )
     ORDER BY rank DESC
     LIMIT $3`,
    [q, tenantId, limit]
  );
  return rows.map((r) => ({ source_id: r.source_id }));
}

module.exports = { lexicalSearch };
