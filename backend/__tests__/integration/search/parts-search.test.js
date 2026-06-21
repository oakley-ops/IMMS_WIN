require('dotenv').config();

// @xenova/transformers is ESM and won't load under jest; stub the models and
// exercise the real tenant-scoped SQL ranking path.
jest.mock('../../../src/services/search/embedder', () => ({
  embed: jest.fn(async () => Array.from({ length: 384 }, () => 0.05)),
  EMBED_DIM: 384,
}));
jest.mock('../../../src/services/search/reranker', () => ({
  score: jest.fn(async (_q, docs) => docs.map(() => 0)), // identity -> keep RRF order
}));

const { executeWithRetry, pool } = require('../../../db');
const { indexPartById, removePart } = require('../../../src/services/search/searchIndexer');
const { rankPartIds } = require('../../../src/services/search/searchService');

let partId;

beforeAll(async () => {
  const a = await executeWithRetry(
    `INSERT INTO parts (name, description, manufacturer_part_number, quantity, minimum_quantity, status, tenant_id)
     VALUES ('ZZUNIFY Hydraulic Fitting','brass NPT fitting','ZZ-UNI-1',5,1,'active',1) RETURNING part_id`,
    []
  );
  partId = a.rows[0].part_id;
  await indexPartById(partId);
}, 60000);

afterAll(async () => {
  await removePart(partId);
  await executeWithRetry('DELETE FROM parts WHERE part_id=$1', [partId]);
  await pool.end();
});

test('rankPartIds ranks the matching part (tenant-scoped)', async () => {
  const { ids } = await rankPartIds({ q: 'ZZUNIFY hydraulic fitting', tenantId: 1, limit: 50 });
  expect(ids).toContain(partId);
});

test('rankPartIds does not return tenant-1 rows for a different tenant', async () => {
  const { ids } = await rankPartIds({ q: 'ZZUNIFY hydraulic fitting', tenantId: 999, limit: 50 });
  expect(ids).not.toContain(partId);
});
