// Factory mocks so jest never loads the real modules (which would pull in
// @xenova/transformers via embedder.js and crash the test runner).
jest.mock('../../../src/services/search/lexicalSearch', () => ({ lexicalSearch: jest.fn() }));
jest.mock('../../../src/services/search/vectorSearch', () => ({ vectorSearch: jest.fn() }));
jest.mock('../../../src/services/search/reranker', () => ({ score: jest.fn() }));
jest.mock('../../../db', () => ({ executeWithRetry: jest.fn() }));

const { lexicalSearch } = require('../../../src/services/search/lexicalSearch');
const { vectorSearch } = require('../../../src/services/search/vectorSearch');
const reranker = require('../../../src/services/search/reranker');
const { executeWithRetry } = require('../../../db');
const { search, rankPartIds } = require('../../../src/services/search/searchService');

// hydrate() runs `... WHERE source_id = ANY($2)` -> params = [tenantId, sourceIds]
const hydrateRows = (ids) =>
  ids.map((source_id) => ({ part_id: source_id, source_id, content: `c${source_id}`, name: `p${source_id}` }));

beforeEach(() => {
  jest.clearAllMocks();
  executeWithRetry.mockImplementation((_sql, params) => Promise.resolve({ rows: hydrateRows(params[1]) }));
});

test('vector failure degrades to lexical-only', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockRejectedValue(new Error('no pgvector'));
  reranker.score.mockResolvedValue([2, 1]);

  const res = await search({ q: 'fitting', tenantId: 1, limit: 10 });
  expect(res.degraded).toContain('vector');
  expect(res.results.length).toBe(2);
});

test('rerank failure keeps RRF order', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockResolvedValue([{ source_id: 2 }, { source_id: 1 }]);
  reranker.score.mockRejectedValue(new Error('rerank down'));

  const res = await search({ q: 'fitting', tenantId: 1, limit: 10 });
  expect(res.degraded).toContain('rerank');
  expect(res.results.length).toBe(2);
});

test('healthy path: rerank reorders, degraded is null', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  reranker.score.mockResolvedValue([0.1, 9.9]); // id2 should win

  const res = await search({ q: 'fitting', tenantId: 1, limit: 10 });
  expect(res.degraded).toBeNull();
  expect(res.results[0].part_id).toBe(2);
});

test('rankPartIds returns reranked part_id order', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  reranker.score.mockResolvedValue([0.1, 9.9]); // id2 wins

  const { ids, degraded } = await rankPartIds({ q: 'x', tenantId: 1, limit: 10 });
  expect(ids).toEqual([2, 1]);
  expect(degraded).toBeNull();
});
