require('dotenv').config();

// @xenova/transformers is ESM and won't load under jest's CJS transform, so the
// real-model path is validated by src/scripts/searchSmoke.js (run under plain node).
// Here we stub the embedder/reranker and exercise the REAL SQL path: tenant-scoped
// lexical + vector queries, RRF, and hydrate. This keeps the tenant-isolation
// invariant runnable in CI without loading the ONNX models.
jest.mock('../../../src/services/search/embedder', () => ({
  embed: jest.fn(async () => Array.from({ length: 384 }, () => 0.05)),
  EMBED_DIM: 384,
}));
jest.mock('../../../src/services/search/reranker', () => ({
  score: jest.fn(async (_q, docs) => docs.map(() => 0)), // identity -> keep RRF order
}));

const { executeWithRetry, pool } = require('../../../db');
const { indexPartById, removePart } = require('../../../src/services/search/searchIndexer');
const { search } = require('../../../src/services/search/searchService');

let partA; // tenant 1
let partB; // tenant 2

beforeAll(async () => {
  // A second tenant must exist: parts.tenant_id and search_documents.tenant_id both FK auth.tenants.
  await executeWithRetry(
    `INSERT INTO auth.tenants (tenant_id, slug, display_name, status)
     VALUES (2, 'test-tenant-2', 'Test Tenant 2', 'active')
     ON CONFLICT (tenant_id) DO NOTHING`,
    []
  );
  const a = await executeWithRetry(
    `INSERT INTO parts (name, description, manufacturer_part_number, quantity, minimum_quantity, status, tenant_id)
     VALUES ('ZZTESTPART Hydraulic Fitting','1/4 inch brass NPT fitting','BR-14NPT',5,1,'active',1) RETURNING part_id`,
    []
  );
  partA = a.rows[0].part_id;
  const b = await executeWithRetry(
    `INSERT INTO parts (name, description, manufacturer_part_number, quantity, minimum_quantity, status, tenant_id)
     VALUES ('ZZSECRET Tenant2 Bolt','should never appear for tenant 1','SECRET-1',9,1,'active',2) RETURNING part_id`,
    []
  );
  partB = b.rows[0].part_id;
  await indexPartById(partA);
  await indexPartById(partB);
}, 60000);

afterAll(async () => {
  await removePart(partA);
  await removePart(partB);
  await executeWithRetry('DELETE FROM parts WHERE part_id = ANY($1)', [[partA, partB]]);
  await executeWithRetry('DELETE FROM auth.tenants WHERE tenant_id = 2', []);
  await pool.end();
});

test('lexical retrieval returns the matching part (tenant 1)', async () => {
  const res = await search({ q: 'ZZTESTPART hydraulic fitting', tenantId: 1, limit: 10 });
  expect(res.results.map((r) => r.part_id)).toContain(partA);
});

test('tenant isolation: tenant 1 never sees tenant 2 rows', async () => {
  const res = await search({ q: 'ZZSECRET bolt', tenantId: 1, limit: 10 });
  expect(res.results.map((r) => r.part_id)).not.toContain(partB);
});
