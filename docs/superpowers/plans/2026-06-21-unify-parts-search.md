# Unify Parts Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task. Steps use checkbox (`- [ ]`).

**Goal:** Make the Parts table's existing search box smart (hybrid ranked) and remove the redundant Smart Search panel — one search box per page.

**Architecture:** `GET /api/v1/parts?search=` delegates to the search module for ranked `part_id`s and returns parts in the table's existing shape (relevance order), with graceful fallback to the current `ILIKE`. The frontend drops the separate panel; the table's box is unchanged on the wire.

**Tech Stack:** Node/Express, PostgreSQL, the existing `backend/src/services/search` module, React/MUI, Jest.

**Spec:** `docs/superpowers/specs/2026-06-21-unify-parts-search-design.md`

**Note:** The "disable column sort during search" item from the spec is **dropped** — sorting in `PartsList` is client-side over the loaded page (no `sort` param is sent), so sorting ranked results just reorders the visible page (harmless). Not worth the risk.

---

## Task 1: Extract `rankPartIds` from the search service

**Files:**
- Modify: `backend/src/services/search/searchService.js`
- Test: `backend/__tests__/unit/search/searchService.test.js`

- [ ] **Step 1: Refactor `searchService.js`** — extract ranking into `rankCandidates`/`rankPartIds`; `search()` reuses it (output unchanged). Replace the whole file body's `search` section with:

```js
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

// channels -> RRF -> rerank. Returns { ordered: hydrated rows (best first), degraded }.
async function rankCandidates({ q, tenantId }) {
  const degraded = [];
  const [lex, vec] = await Promise.all([
    lexicalSearch({ q, tenantId, limit: CANDIDATES }).catch((e) => {
      logger.error('search.lexical failed', { error: e.message }); degraded.push('lexical'); return [];
    }),
    vectorSearch({ q, tenantId, limit: CANDIDATES }).catch((e) => {
      logger.error('search.vector failed', { error: e.message }); degraded.push('vector'); return [];
    }),
  ]);
  const fusedIds = rrfFuse([lex, vec]).slice(0, RERANK_POOL).map((f) => f.source_id);
  let candidates = await hydrate(fusedIds, tenantId);
  if (q && candidates.length) {
    try {
      const scores = await reranker.score(q, candidates.map((c) => c.content));
      candidates = candidates.map((c, i) => ({ ...c, _rerank: scores[i] }))
        .sort((a, b) => b._rerank - a._rerank);
    } catch (e) {
      logger.error('search.rerank failed', { error: e.message }); degraded.push('rerank');
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
```

- [ ] **Step 2: Add `rankPartIds` coverage** to `backend/__tests__/unit/search/searchService.test.js` (keep the existing factory mocks at the top; append):

```js
const { rankPartIds } = require('../../../src/services/search/searchService');

test('rankPartIds returns reranked part_id order', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  reranker.score.mockResolvedValue([0.1, 9.9]); // id 2 wins
  const { ids, degraded } = await rankPartIds({ q: 'x', tenantId: 1, limit: 10 });
  expect(ids).toEqual([2, 1]);
  expect(degraded).toBeNull();
});
```

- [ ] **Step 3: Run** `npx jest __tests__/unit/search/searchService.test.js` → all PASS (existing 3 + new 1).

- [ ] **Step 4: Commit** `git add backend/src/services/search/searchService.js backend/__tests__/unit/search/searchService.test.js && git commit -m "refactor(search): extract rankPartIds; search() reuses it"`

---

## Task 2: Smart-search path in `GET /api/v1/parts`

**Files:**
- Modify: `backend/src/routes/parts.js` (the `router.get('/', ...)` handler, ~line 109)
- Test: `backend/__tests__/integration/search/parts-search.test.js`

- [ ] **Step 1: Add requires** at the top of `parts.js` (near the other requires):

```js
const { rankPartIds } = require('../services/search/searchService');
const { currentTenantId } = require('../middleware/tenantScope');
```

- [ ] **Step 2: Insert the ranked path** at the very start of the `router.get('/', ...)` `try` block, right after `const offset = page * limit;` and the other query-param parsing (before the `whereConditions` build). It returns early on success; on any error it falls through to the existing `ILIKE` code:

```js
    // Smart search: when a free-text query is present, rank via the hybrid search
    // module and return parts in the table's shape (relevance order). Falls back
    // to the ILIKE path below on any error so search never hard-fails.
    if (search) {
      try {
        const tenantId = currentTenantId(req);
        const { ids } = await rankPartIds({ q: search, tenantId, limit: 100 });
        const total = ids.length;
        const pageIds = ids.slice(page * limit, page * limit + limit);
        if (pageIds.length === 0) {
          return res.json({ items: [], total, page, limit, totalPages: Math.ceil(total / limit), queryTime: 0 });
        }
        const ranked = await executeWithRetry(
          `SELECT
             p.part_id, p.name, p.description, p.manufacturer_part_number,
             p.quantity::integer, p.minimum_quantity::integer,
             pl.name as location, CAST(p.unit_cost AS NUMERIC) as unit_cost,
             CAST(p.unit_cost AS NUMERIC) as cost, p.supplier as manufacturer,
             p.image_url, p.created_at as last_ordered_date, p.updated_at,
             COALESCE(p.status, 'active') as status, p.notes
           FROM parts p
           LEFT JOIN part_locations pl ON p.location_id = pl.location_id
           WHERE p.part_id = ANY($1)`,
          [pageIds]
        );
        const byId = new Map(ranked.rows.map((r) => [r.part_id, r]));
        const items = pageIds.map((id) => byId.get(id)).filter(Boolean);
        return res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit), queryTime: 0 });
      } catch (e) {
        console.error('Smart search failed; falling back to ILIKE:', e.message);
        // fall through to the existing ILIKE path
      }
    }
```

- [ ] **Step 3: Integration test** `backend/__tests__/integration/search/parts-search.test.js`:

```js
require('dotenv').config();
jest.mock('../../../src/services/search/embedder', () => ({
  embed: jest.fn(async () => Array.from({ length: 384 }, () => 0.05)), EMBED_DIM: 384,
}));
jest.mock('../../../src/services/search/reranker', () => ({
  score: jest.fn(async (_q, docs) => docs.map(() => 0)),
}));
const { executeWithRetry, pool } = require('../../../db');
const { indexPartById, removePart } = require('../../../src/services/search/searchIndexer');
const { rankPartIds } = require('../../../src/services/search/searchService');

let partId;
beforeAll(async () => {
  const a = await executeWithRetry(
    `INSERT INTO parts (name, description, manufacturer_part_number, quantity, minimum_quantity, status, tenant_id)
     VALUES ('ZZUNIFY Hydraulic Fitting','brass NPT fitting','ZZ-UNI-1',5,1,'active',1) RETURNING part_id`, []);
  partId = a.rows[0].part_id;
  await indexPartById(partId);
}, 60000);
afterAll(async () => {
  await removePart(partId);
  await executeWithRetry('DELETE FROM parts WHERE part_id=$1', [partId]);
  await pool.end();
});

test('rankPartIds ranks the matching part', async () => {
  const { ids } = await rankPartIds({ q: 'ZZUNIFY hydraulic fitting', tenantId: 1, limit: 50 });
  expect(ids).toContain(partId);
});
```

- [ ] **Step 4: Run** `npx jest __tests__/integration/search/parts-search.test.js --runInBand` → PASS.

- [ ] **Step 5: Commit** `git add backend/src/routes/parts.js backend/__tests__/integration/search/parts-search.test.js && git commit -m "feat(search): smart-search path in GET /api/v1/parts (ranked + ILIKE fallback)"`

---

## Task 3: Frontend — one search box

**Files:**
- Modify: `frontend/src/pages/Parts.tsx`
- Modify: `frontend/src/components/PartsList.tsx` (placeholder, ~line 1226)
- Delete: `frontend/src/components/PartSearch.tsx`
- Delete: `frontend/src/services/searchApi.ts` (only if unreferenced — verify with grep)

- [ ] **Step 1: Remove the Smart Search panel** — `Parts.tsx`: drop the import and revert the `/` route.

Change `import PartSearch from '../components/PartSearch';` → delete the line.
Change `<Route path="/" element={<><PartSearch /><PartsList /></>} />` → `<Route path="/" element={<PartsList />} />`.

- [ ] **Step 2: Update the table search placeholder** — `PartsList.tsx` line ~1226:

`placeholder="Search by name, part number, location..."` → `placeholder="Search by description, part number, or what it's used for…"`

- [ ] **Step 3: Verify `searchApi.ts` is unreferenced, then delete both files**

Run: `grep -rn "searchApi\|PartSearch" frontend/src` — expect no matches after Steps 1-2 (other than the files themselves).
Then: `git rm frontend/src/components/PartSearch.tsx frontend/src/services/searchApi.ts`

- [ ] **Step 4: Typecheck** `cd frontend && npx tsc --noEmit` → 0 errors in changed files.

- [ ] **Step 5: Commit** `git add frontend/src/pages/Parts.tsx frontend/src/components/PartsList.tsx && git commit -m "feat(search): single smart search box on Parts page (drop redundant panel)"`

---

## Task 4: End-to-end verification + app functional

- [ ] **Step 1:** Full search unit + integration suite: `cd backend && npx jest __tests__/unit/search __tests__/integration/search --runInBand` → all PASS.
- [ ] **Step 2:** Restart the backend (native) so the route change loads; confirm `GET /api/v1/parts?search=bearing` (with a JWT) returns ranked parts (`Deep Groove Ball Bearing` first-ish).
- [ ] **Step 3:** Browser E2E: load `/parts`, confirm there is **one** search box, type "ball bearing" → table shows ranked parts; clear → full list returns. Screenshot.
- [ ] **Step 4:** Confirm the whole stack is up (backend :4000, frontends :3001/:3002, MCS).

---

## Self-review

- Spec coverage: backend delegation (T2) ✓; rankPartIds extraction (T1) ✓; fallback to ILIKE (T2) ✓; remove panel + placeholder (T3) ✓; retire PartSearch/searchApi (T3) ✓; tests (T1/T2/T4) ✓. Sort-disable intentionally dropped (documented above). ✓
- Placeholders: none. Type consistency: `rankPartIds({q,tenantId,limit}) -> {ids,degraded}` used identically in T1/T2; `search()` output unchanged.
