# Hybrid Parts Search (RAG retrieval) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tenant-scoped hybrid search over parts (Postgres FTS + trigram + pgvector kNN, fused with RRF, reranked by a local cross-encoder) exposed at `GET /api/v1/search`, returning ranked part records with citations — no LLM in the request path.

**Architecture:** A bounded module at `backend/src/services/search/` with its own `search_documents` table in the existing Postgres. Embeddings + reranking run locally in-process via `@xenova/transformers` (ONNX, no API key). Parts are indexed on create/update/delete and via a backfill script. Search degrades gracefully (rerank fail → RRF order; embedder/pgvector fail → lexical-only). Every read is scoped by `tenant_id`.

**Tech Stack:** Node/Express, PostgreSQL (`pgvector` + `pg_trgm` extensions), `@xenova/transformers` (`bge-small-en-v1.5` bi-encoder, `ms-marco-MiniLM-L-6-v2` cross-encoder), Jest.

**Spec:** `docs/superpowers/specs/2026-06-20-imms-rag-hybrid-parts-search-design.md`

---

## Conventions discovered in this codebase (read before starting)

- DB access: `const { pool, executeWithRetry } = require('<rel>/db')`. From `backend/src/routes/*` → `../../db`. From `backend/src/services/search/*` → `../../../db`. From `backend/src/scripts/*` → `../../db`.
- Logger (winston): `const { logger } = require('<rel>/utils/logger')`. From `backend/src/services/search/*` → `../../utils/logger`.
- Auth in routes (mirror `parts.js`): `const { authenticateToken } = require('../../middleware/auth');` and `const roleAuthorization = require('../middleware/roleMiddleware');`.
- Tenant: `const { currentTenantId } = require('../middleware/tenantScope');` then `const tenantId = currentTenantId(req);` (returns `req.user.tenant_id ?? 1`).
- Numbered `.sql` migrations are applied **by hand** — `npm run migrate` only applies `db/schema.sql` once. New DDL ships as a `.sql` file **plus** a one-off runner in `src/scripts/` (pattern: `src/scripts/createFailedEmailTable.js`).
- Tests live in `backend/__tests__/unit/**` and `backend/__tests__/integration/**`; run with `npm test` / `npm run test:unit` / `npm run test:integration` (jest, from `/backend`).
- Parts schema (relevant cols): `part_id, name, description, manufacturer_part_number, internal_part_number, supplier, notes, status, location_id (FK part_locations), tenant_id`. Location text = `part_locations.name`. Index only `status='active'` parts.

---

## File structure

```
backend/
  migrations/20260620_create_search_documents.sql      # DDL (applied via the script below)
  src/scripts/createSearchDocumentsTable.js            # one-off DDL runner
  src/scripts/reindexSearch.js                         # npm run search:reindex
  src/services/search/
    partContent.js      # pure: buildPartContent(part), contentHash(text)
    rrf.js              # pure: rrfFuse(rankedLists)
    embedder.js         # bge-small bi-encoder singleton: embed(text,{isQuery})
    reranker.js         # ms-marco cross-encoder singleton: score(query, docs[])
    lexicalSearch.js    # FTS + trigram channel
    vectorSearch.js     # pgvector kNN channel
    searchIndexer.js    # indexPartById / removePart / reindexAll
    searchService.js    # orchestrate channels -> RRF -> rerank -> hydrate -> degraded
  src/routes/search.js                                 # GET /api/v1/search
  src/app.js                                           # mount router (modify)
  src/routes/parts.js                                  # index hooks on create/update/delete (modify)
  __tests__/unit/search/{rrf,partContent,searchService}.test.js
  __tests__/integration/search/search.test.js
frontend/
  src/services/searchApi.ts                            # search() client (verify api.ts base during exec)
  (search results wiring — confirm existing search bar during exec)
```

---

## Task 0: Verify pgvector + pg_trgm are installable (spike — do this first)

**Files:** none (verification only).

- [ ] **Step 1: Check the extensions are available**

Run from `/backend`:
```bash
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL}); p.query(\"SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name IN ('vector','pg_trgm')\").then(r=>{console.table(r.rows); return p.end();}).catch(e=>{console.error('ERR',e.message); process.exit(1);});"
```
Expected: two rows (`vector`, `pg_trgm`) with a non-null `default_version`.

- [ ] **Step 2: Decide path**

- Both present → proceed with this plan as written.
- `pg_trgm` present, `vector` missing → install pgvector (prebuilt Windows binary for the PG major version, or build from source), re-run Step 1.
- `vector` not installable at all → switch the vector column to `real[]` and compute cosine in SQL/JS per the spec's fallback (changes Task 2 DDL + Task 8 query only; everything else holds). Note the deviation in the plan and continue.

No commit (no files changed).

---

## Task 1: Add the transformers.js dependency

**Files:** Modify `backend/package.json` (via npm).

- [ ] **Step 1: Install**

Run from `/backend`:
```bash
npm install @xenova/transformers@^2.17.2
```

- [ ] **Step 2: Verify it imports and can fetch a model**

Run from `/backend`:
```bash
node -e "const {pipeline}=require('@xenova/transformers'); pipeline('feature-extraction','Xenova/bge-small-en-v1.5').then(async e=>{const o=await e('hello',{pooling:'mean',normalize:true}); console.log('dim=',o.data.length); process.exit(0);}).catch(e=>{console.error(e); process.exit(1);});"
```
Expected: `dim= 384` (first run downloads ~120MB of weights to a local cache).

- [ ] **Step 3: Commit**
```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(search): add @xenova/transformers for local embeddings"
```

---

## Task 2: Create the `search_documents` table

**Files:**
- Create: `backend/migrations/20260620_create_search_documents.sql`
- Create: `backend/src/scripts/createSearchDocumentsTable.js`

- [ ] **Step 1: Write the migration SQL**

`backend/migrations/20260620_create_search_documents.sql`:
```sql
-- Hybrid search index for parts (RAG retrieval). See
-- docs/superpowers/specs/2026-06-20-imms-rag-hybrid-parts-search-design.md
BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS search_documents (
  id            bigserial PRIMARY KEY,
  tenant_id     int  NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id),
  source_type   text NOT NULL,
  source_id     int  NOT NULL,
  content       text NOT NULL,
  tsv           tsvector,
  embedding     vector(384),
  content_hash  text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS search_documents_tsv_idx   ON search_documents USING GIN (tsv);
CREATE INDEX IF NOT EXISTS search_documents_vec_idx   ON search_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS search_documents_scope_idx ON search_documents (tenant_id, source_type);
CREATE INDEX IF NOT EXISTS search_documents_trgm_idx  ON search_documents USING gin (content gin_trgm_ops);

COMMIT;
```
> If Task 0 chose the `real[]` fallback: change `embedding vector(384)` to `embedding real[]` and drop `search_documents_vec_idx`.

- [ ] **Step 2: Write the runner script**

`backend/src/scripts/createSearchDocumentsTable.js`:
```js
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(
    path.join(__dirname, '../../migrations/20260620_create_search_documents.sql'),
    'utf8'
  );
  try {
    await pool.query(sql);
    console.log('✅ search_documents table + extensions created');
  } catch (e) {
    console.error('❌ failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
```

- [ ] **Step 3: Apply it**

Run from `/backend`:
```bash
node src/scripts/createSearchDocumentsTable.js
```
Expected: `✅ search_documents table + extensions created`.

- [ ] **Step 4: Commit**
```bash
git add backend/migrations/20260620_create_search_documents.sql backend/src/scripts/createSearchDocumentsTable.js
git commit -m "feat(search): search_documents table + pgvector/pg_trgm extensions"
```

---

## Task 3: RRF fusion (pure logic, TDD)

**Files:**
- Create: `backend/src/services/search/rrf.js`
- Test: `backend/__tests__/unit/search/rrf.test.js`

- [ ] **Step 1: Write the failing test**

`backend/__tests__/unit/search/rrf.test.js`:
```js
const { rrfFuse } = require('../../../src/services/search/rrf');

describe('rrfFuse', () => {
  test('item ranked high in both lists wins', () => {
    const lexical = [{ source_id: 1 }, { source_id: 2 }, { source_id: 3 }];
    const vector  = [{ source_id: 3 }, { source_id: 1 }, { source_id: 9 }];
    const fused = rrfFuse([lexical, vector]);
    expect(fused[0].source_id).toBe(1); // appears near top of both
    expect(fused.map(f => f.source_id)).toEqual(expect.arrayContaining([1, 2, 3, 9]));
    expect(fused.every((f, i) => i === 0 || fused[i - 1].score >= f.score)).toBe(true);
  });

  test('handles empty lists', () => {
    expect(rrfFuse([[], []])).toEqual([]);
    expect(rrfFuse([[{ source_id: 5 }], []])[0].source_id).toBe(5);
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm run test:unit -- rrf`
Expected: FAIL — cannot find module `rrf`.

- [ ] **Step 3: Implement**

`backend/src/services/search/rrf.js`:
```js
const RRF_K = 60;

// rankedLists: array of arrays of { source_id }, each ordered best-first.
// Returns [{ source_id, score }] sorted by score desc.
function rrfFuse(rankedLists, { k = RRF_K } = {}) {
  const scores = new Map();
  for (const list of rankedLists) {
    list.forEach((item, idx) => {
      const rank = idx + 1; // 1-based
      scores.set(item.source_id, (scores.get(item.source_id) || 0) + 1 / (k + rank));
    });
  }
  return [...scores.entries()]
    .map(([source_id, score]) => ({ source_id, score }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { rrfFuse, RRF_K };
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npm run test:unit -- rrf`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add backend/src/services/search/rrf.js backend/__tests__/unit/search/rrf.test.js
git commit -m "feat(search): reciprocal rank fusion"
```

---

## Task 4: Part content assembly + hash (pure logic, TDD)

**Files:**
- Create: `backend/src/services/search/partContent.js`
- Test: `backend/__tests__/unit/search/partContent.test.js`

- [ ] **Step 1: Write the failing test**

`backend/__tests__/unit/search/partContent.test.js`:
```js
const { buildPartContent, contentHash } = require('../../../src/services/search/partContent');

describe('buildPartContent', () => {
  test('joins present fields, skips nulls', () => {
    const content = buildPartContent({
      name: 'Hydraulic Fitting',
      description: '1/4" NPT brass',
      manufacturer_part_number: 'BR-14NPT',
      internal_part_number: null,
      supplier: 'Acme',
      location: 'Bin A3',
      notes: null,
    });
    expect(content).toContain('Hydraulic Fitting');
    expect(content).toContain('MPN: BR-14NPT');
    expect(content).toContain('Supplier: Acme');
    expect(content).not.toContain('PN:');   // internal_part_number was null
    expect(content).not.toContain('Notes:');
  });
});

describe('contentHash', () => {
  test('stable and order-sensitive', () => {
    expect(contentHash('a')).toBe(contentHash('a'));
    expect(contentHash('a')).not.toBe(contentHash('b'));
  });
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm run test:unit -- partContent`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement**

`backend/src/services/search/partContent.js`:
```js
const crypto = require('crypto');

// part: { name, description, manufacturer_part_number, internal_part_number,
//         supplier, location, notes }  (location is part_locations.name)
function buildPartContent(part) {
  const lines = [];
  if (part.name) lines.push(part.name);
  if (part.description) lines.push(part.description);
  if (part.manufacturer_part_number) lines.push(`MPN: ${part.manufacturer_part_number}`);
  if (part.internal_part_number) lines.push(`PN: ${part.internal_part_number}`);
  if (part.supplier) lines.push(`Supplier: ${part.supplier}`);
  if (part.location) lines.push(`Location: ${part.location}`);
  if (part.notes) lines.push(`Notes: ${part.notes}`);
  return lines.join('\n');
}

function contentHash(text) {
  return crypto.createHash('sha256').update(text || '').digest('hex');
}

module.exports = { buildPartContent, contentHash };
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npm run test:unit -- partContent`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add backend/src/services/search/partContent.js backend/__tests__/unit/search/partContent.test.js
git commit -m "feat(search): part content assembly + content hash"
```

---

## Task 5: Embedder (bi-encoder singleton)

**Files:** Create `backend/src/services/search/embedder.js`

- [ ] **Step 1: Implement**

`backend/src/services/search/embedder.js`:
```js
const { pipeline } = require('@xenova/transformers');
const { logger } = require('../../utils/logger');

const MODEL = 'Xenova/bge-small-en-v1.5';
const EMBED_DIM = 384;
// bge is asymmetric: queries get a retrieval instruction prefix, documents do not.
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';

let extractorPromise = null;
function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL).catch((e) => {
      extractorPromise = null; // allow retry on next call
      logger.error('search.embedder load failed', { error: e.message });
      throw e;
    });
  }
  return extractorPromise;
}

async function embed(text, { isQuery = false } = {}) {
  const extractor = await getExtractor();
  const input = isQuery ? QUERY_PREFIX + text : text;
  const output = await extractor(input, { pooling: 'mean', normalize: true });
  return Array.from(output.data); // length 384, L2-normalized
}

module.exports = { embed, getExtractor, EMBED_DIM, MODEL };
```

- [ ] **Step 2: Verify by running**

Run from `/backend`:
```bash
node -e "const {embed,EMBED_DIM}=require('./src/services/search/embedder'); embed('hydraulic fitting',{isQuery:true}).then(v=>{console.log('len',v.length,'== ',EMBED_DIM); process.exit(v.length===EMBED_DIM?0:1);});"
```
Expected: `len 384 == 384`.

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/search/embedder.js
git commit -m "feat(search): local bge-small embedder"
```

---

## Task 6: Reranker (cross-encoder singleton)

**Files:** Create `backend/src/services/search/reranker.js`

> The transformers.js sequence-classification API is the most version-sensitive piece. Step 2 catches drift immediately.

- [ ] **Step 1: Implement**

`backend/src/services/search/reranker.js`:
```js
const { AutoTokenizer, AutoModelForSequenceClassification } = require('@xenova/transformers');
const { logger } = require('../../utils/logger');

const MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2'; // small CPU cross-encoder

let loadPromise = null;
function load() {
  if (!loadPromise) {
    loadPromise = Promise.all([
      AutoTokenizer.from_pretrained(MODEL),
      AutoModelForSequenceClassification.from_pretrained(MODEL),
    ]).then(([tokenizer, model]) => ({ tokenizer, model }))
      .catch((e) => {
        loadPromise = null;
        logger.error('search.reranker load failed', { error: e.message });
        throw e;
      });
  }
  return loadPromise;
}

// Returns a relevance score per doc (higher = more relevant), same order as docs.
async function score(query, docs) {
  if (!docs.length) return [];
  const { tokenizer, model } = await load();
  const inputs = tokenizer(docs.map(() => query), {
    text_pair: docs,
    padding: true,
    truncation: true,
  });
  const { logits } = await model(inputs);
  return logits.tolist().map((row) => row[0]);
}

module.exports = { score, load, MODEL };
```

- [ ] **Step 2: Verify by running (catches API drift)**

Run from `/backend`:
```bash
node -e "const {score}=require('./src/services/search/reranker'); score('brass fitting',['1/4 inch brass NPT fitting','steel hex bolt']).then(s=>{console.log(s); process.exit(s.length===2 && s[0]>s[1]?0:1);});"
```
Expected: two numbers, first > second (the fitting outranks the bolt). If the API shape differs in the installed version, fix `score()` here before proceeding.

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/search/reranker.js
git commit -m "feat(search): local cross-encoder reranker"
```

---

## Task 7: Indexer (index/remove/backfill)

**Files:** Create `backend/src/services/search/searchIndexer.js`

- [ ] **Step 1: Implement**

`backend/src/services/search/searchIndexer.js`:
```js
const { executeWithRetry } = require('../../../db');
const { logger } = require('../../utils/logger');
const { embed } = require('./embedder');
const { buildPartContent, contentHash } = require('./partContent');

const SOURCE = 'part';

// Selects one active part with its location name, ready for buildPartContent.
const PART_SELECT = `
  SELECT p.part_id, p.name, p.description, p.manufacturer_part_number,
         p.internal_part_number, p.supplier, p.notes, p.tenant_id,
         pl.name AS location
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
  const vecLiteral = `[${vec.join(',')}]`;
  await executeWithRetry(
    `INSERT INTO search_documents
       (tenant_id, source_type, source_id, content, tsv, embedding, content_hash, updated_at)
     VALUES ($1,$2,$3,$4, to_tsvector('english',$4), $5::vector, $6, now())
     ON CONFLICT (tenant_id, source_type, source_id)
     DO UPDATE SET content=EXCLUDED.content, tsv=EXCLUDED.tsv,
                   embedding=EXCLUDED.embedding, content_hash=EXCLUDED.content_hash,
                   updated_at=now()`,
    [tenantId, SOURCE, partId, content, vecLiteral, hash]
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
    try { await indexPartById(r.part_id); n++; }
    catch (e) { logger.error('search.reindex part failed', { partId: r.part_id, error: e.message }); }
  }
  return n;
}

module.exports = { indexPartById, removePart, reindexAll };
```

- [ ] **Step 2: Verify after Task 12 backfill** (no standalone test here — exercised by the integration test in Task 10 and the backfill in Task 12).

- [ ] **Step 3: Commit**
```bash
git add backend/src/services/search/searchIndexer.js
git commit -m "feat(search): part indexer (index/remove/reindexAll)"
```

---

## Task 8: Vector + lexical channels

**Files:**
- Create: `backend/src/services/search/vectorSearch.js`
- Create: `backend/src/services/search/lexicalSearch.js`

- [ ] **Step 1: Implement vectorSearch**

`backend/src/services/search/vectorSearch.js`:
```js
const { executeWithRetry } = require('../../../db');
const { embed } = require('./embedder');

async function vectorSearch({ q, tenantId, limit = 50 }) {
  const vec = await embed(q, { isQuery: true });
  const vecLiteral = `[${vec.join(',')}]`;
  const { rows } = await executeWithRetry(
    `SELECT source_id
     FROM search_documents
     WHERE tenant_id=$2 AND source_type='part' AND embedding IS NOT NULL
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vecLiteral, tenantId, limit]
  );
  return rows.map((r) => ({ source_id: r.source_id }));
}

module.exports = { vectorSearch };
```

- [ ] **Step 2: Implement lexicalSearch**

`backend/src/services/search/lexicalSearch.js`:
```js
const { executeWithRetry } = require('../../../db');

// FTS over the indexed content + trigram fuzzy match on the part code columns.
async function lexicalSearch({ q, tenantId, limit = 50 }) {
  const { rows } = await executeWithRetry(
    `SELECT sd.source_id,
            ts_rank_cd(sd.tsv, plainto_tsquery('english', $1))
              + GREATEST(
                  similarity(coalesce(p.internal_part_number,''), $1),
                  similarity(coalesce(p.manufacturer_part_number,''), $1)
                ) AS rank
     FROM search_documents sd
     JOIN parts p ON p.part_id = sd.source_id
     WHERE sd.tenant_id = $2
       AND sd.source_type = 'part'
       AND ( sd.tsv @@ plainto_tsquery('english', $1)
             OR p.internal_part_number ILIKE '%'||$1||'%'
             OR p.manufacturer_part_number ILIKE '%'||$1||'%' )
     ORDER BY rank DESC
     LIMIT $3`,
    [q, tenantId, limit]
  );
  return rows.map((r) => ({ source_id: r.source_id }));
}

module.exports = { lexicalSearch };
```

- [ ] **Step 3: Commit** (channels are covered by the integration test in Task 10)
```bash
git add backend/src/services/search/vectorSearch.js backend/src/services/search/lexicalSearch.js
git commit -m "feat(search): vector (pgvector) and lexical (FTS+trgm) channels"
```

---

## Task 9: Search orchestrator with graceful degradation (TDD)

**Files:**
- Create: `backend/src/services/search/searchService.js`
- Test: `backend/__tests__/unit/search/searchService.test.js`

- [ ] **Step 1: Write the failing test** (mocks the channels/rerank/db so it's pure logic)

`backend/__tests__/unit/search/searchService.test.js`:
```js
jest.mock('../../../src/services/search/lexicalSearch');
jest.mock('../../../src/services/search/vectorSearch');
jest.mock('../../../src/services/search/reranker');
jest.mock('../../../db', () => ({ executeWithRetry: jest.fn() }));

const { lexicalSearch } = require('../../../src/services/search/lexicalSearch');
const { vectorSearch } = require('../../../src/services/search/vectorSearch');
const reranker = require('../../../src/services/search/reranker');
const { executeWithRetry } = require('../../../db');
const { search } = require('../../../src/services/search/searchService');

const hydrate = (ids) => ({ rows: ids.map((source_id) => ({ part_id: source_id, source_id, content: `c${source_id}`, name: `p${source_id}` })) });

beforeEach(() => jest.clearAllMocks());

test('vector failure degrades to lexical-only', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockRejectedValue(new Error('no pgvector'));
  reranker.score.mockResolvedValue([2, 1]);
  executeWithRetry.mockImplementation((_sql, params) => Promise.resolve(hydrate(params[0])));

  const res = await search({ q: 'fitting', tenantId: 1, limit: 10 });
  expect(res.degraded).toContain('vector');
  expect(res.results.length).toBe(2);
});

test('rerank failure keeps RRF order', async () => {
  lexicalSearch.mockResolvedValue([{ source_id: 1 }, { source_id: 2 }]);
  vectorSearch.mockResolvedValue([{ source_id: 2 }, { source_id: 1 }]);
  reranker.score.mockRejectedValue(new Error('rerank down'));
  executeWithRetry.mockImplementation((_sql, params) => Promise.resolve(hydrate(params[0])));

  const res = await search({ q: 'fitting', tenantId: 1, limit: 10 });
  expect(res.degraded).toContain('rerank');
  expect(res.results.length).toBe(2);
});
```

- [ ] **Step 2: Run it, verify it fails**

Run: `npm run test:unit -- searchService`
Expected: FAIL — cannot find module `searchService`.

- [ ] **Step 3: Implement**

`backend/src/services/search/searchService.js`:
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
            p.manufacturer_part_number, p.internal_part_number, p.quantity,
            pl.name AS location
     FROM search_documents sd
     JOIN parts p ON p.part_id = sd.source_id
     LEFT JOIN part_locations pl ON p.location_id = pl.location_id
     WHERE sd.tenant_id = $1 AND sd.source_type='part' AND sd.source_id = ANY($2)`,
    [tenantId, sourceIds]
  );
  const byId = new Map(rows.map((r) => [r.source_id, r]));
  return sourceIds.map((id) => byId.get(id)).filter(Boolean); // preserve fused order
}

async function search({ q, tenantId, limit = 10 }) {
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
  let candidates = await hydrate(fusedIds, tenantId); // already in fused order

  if (q && candidates.length) {
    try {
      const scores = await reranker.score(q, candidates.map((c) => c.content));
      candidates = candidates
        .map((c, i) => ({ ...c, rerank_score: scores[i] }))
        .sort((a, b) => b.rerank_score - a.rerank_score);
    } catch (e) {
      logger.error('search.rerank failed', { error: e.message });
      degraded.push('rerank'); // keep RRF order
    }
  }

  return {
    results: candidates.slice(0, limit).map((c) => ({
      part_id: c.part_id,
      name: c.name,
      description: c.description,
      manufacturer_part_number: c.manufacturer_part_number,
      internal_part_number: c.internal_part_number,
      quantity: c.quantity,
      location: c.location,
      citation: { type: 'part', id: c.part_id, href: `/parts/${c.part_id}` },
    })),
    degraded: degraded.length ? degraded : null,
  };
}

module.exports = { search };
```

- [ ] **Step 4: Run it, verify it passes**

Run: `npm run test:unit -- searchService`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**
```bash
git add backend/src/services/search/searchService.js backend/__tests__/unit/search/searchService.test.js
git commit -m "feat(search): orchestrator with layered graceful degradation"
```

---

## Task 10: Route + mount + integration test (tenant isolation, degradation)

**Files:**
- Create: `backend/src/routes/search.js`
- Modify: `backend/src/app.js` (add require + `app.use`)
- Test: `backend/__tests__/integration/search/search.test.js`

- [ ] **Step 1: Implement the route**

`backend/src/routes/search.js`:
```js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');
const roleAuthorization = require('../middleware/roleMiddleware');
const { currentTenantId } = require('../middleware/tenantScope');
const { logger } = require('../utils/logger');
const { search } = require('../services/search/searchService');

const ROLES_ALL = ['admin', 'tech', 'purchasing'];

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     summary: Hybrid search over parts (FTS + vector, RRF + rerank)
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *     responses:
 *       200: { description: Ranked parts with citations }
 */
router.get('/', authenticateToken, roleAuthorization(ROLES_ALL), async (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const tenantId = currentTenantId(req);
  if (!q) return res.json({ results: [], degraded: null, queryTimeMs: 0 });

  const start = Date.now();
  try {
    const { results, degraded } = await search({ q, tenantId, limit });
    const queryTimeMs = Date.now() - start;
    logger.info('search.query', { tenantId, q, count: results.length, degraded, queryTimeMs });
    res.json({ results, degraded, queryTimeMs });
  } catch (e) {
    logger.error('search.query failed', { tenantId, q, error: e.message });
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Mount in app.js**

In `backend/src/app.js`, near the other route requires add:
```js
const searchRouter = require('./routes/search');
```
And next to `app.use('/api/v1/parts', partsRouter);` add:
```js
app.use('/api/v1/search', searchRouter);
```

- [ ] **Step 3: Write the integration test** (requires a test DB with the migration applied)

`backend/__tests__/integration/search/search.test.js`:
```js
const { executeWithRetry } = require('../../../db');
const { indexPartById, removePart } = require('../../../src/services/search/searchIndexer');
const { search } = require('../../../src/services/search/searchService');

let partA, partB;

beforeAll(async () => {
  const a = await executeWithRetry(
    `INSERT INTO parts (name, description, manufacturer_part_number, quantity, minimum_quantity, status, tenant_id)
     VALUES ('Hydraulic Fitting','1/4 inch brass NPT fitting','BR-14NPT',5,1,'active',1) RETURNING part_id`, []
  );
  partA = a.rows[0].part_id;
  const b = await executeWithRetry(
    `INSERT INTO parts (name, description, manufacturer_part_number, quantity, minimum_quantity, status, tenant_id)
     VALUES ('Tenant2 Secret Bolt','should never appear for tenant 1','SECRET-1',9,1,'active',2) RETURNING part_id`, []
  );
  partB = b.rows[0].part_id;
  await indexPartById(partA);
  await indexPartById(partB);
}, 60000);

afterAll(async () => {
  await removePart(partA); await removePart(partB);
  await executeWithRetry('DELETE FROM parts WHERE part_id = ANY($1)', [[partA, partB]]);
});

test('finds a part by fuzzy description', async () => {
  const res = await search({ q: 'brass connector for hydraulics', tenantId: 1, limit: 10 });
  expect(res.results.map((r) => r.part_id)).toContain(partA);
}, 60000);

test('tenant isolation: tenant 1 never sees tenant 2 rows', async () => {
  const res = await search({ q: 'secret bolt', tenantId: 1, limit: 10 });
  expect(res.results.map((r) => r.part_id)).not.toContain(partB);
}, 60000);
```

- [ ] **Step 4: Run it**

Run: `npm run test:integration -- search`
Expected: PASS (2 tests). (First run is slow — model downloads/loads.)

- [ ] **Step 5: Commit**
```bash
git add backend/src/routes/search.js backend/src/app.js backend/__tests__/integration/search/search.test.js
git commit -m "feat(search): GET /api/v1/search route + tenant-isolation integration test"
```

---

## Task 11: Backfill script + npm command

**Files:**
- Create: `backend/src/scripts/reindexSearch.js`
- Modify: `backend/package.json` (scripts)

- [ ] **Step 1: Implement the script**

`backend/src/scripts/reindexSearch.js`:
```js
require('dotenv').config();
const { pool } = require('../../db');
const { reindexAll } = require('../services/search/searchIndexer');

async function run() {
  const tenantId = parseInt(process.argv[2], 10) || 1;
  console.log(`Reindexing search for tenant ${tenantId}...`);
  try {
    const n = await reindexAll(tenantId);
    console.log(`✅ Indexed ${n} parts`);
  } catch (e) {
    console.error('❌ reindex failed:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
run();
```

- [ ] **Step 2: Add the npm script**

In `backend/package.json` `"scripts"`, add:
```json
"search:reindex": "node src/scripts/reindexSearch.js"
```

- [ ] **Step 3: Run the backfill**

Run from `/backend`:
```bash
npm run search:reindex
```
Expected: `✅ Indexed <N> parts` (N = active parts for tenant 1).

- [ ] **Step 4: Commit**
```bash
git add backend/src/scripts/reindexSearch.js backend/package.json
git commit -m "feat(search): backfill script (npm run search:reindex)"
```

---

## Task 12: Keep the index fresh on part writes

**Files:** Modify `backend/src/routes/parts.js`

> Indexing must never break a part write — wrap each hook in try/catch and log. Add the hooks to the **authenticated** `POST /` (line ~416), `PUT /:id` (line ~495), and `DELETE /:id` (line ~620) handlers, after their `COMMIT`/success.

- [ ] **Step 1: Import the indexer**

At the top of `backend/src/routes/parts.js` (with the other requires):
```js
const searchIndexer = require('../services/search/searchIndexer');
```

- [ ] **Step 2: Hook create + update** — after the `COMMIT` and before/after `res` in `POST /` and `PUT /:id`, using the returned row id:
```js
// fire-and-forget; indexing failure must not fail the request
searchIndexer.indexPartById(result.rows[0].part_id)
  .catch((e) => console.error('search index (upsert) failed:', e.message));
```

- [ ] **Step 3: Hook delete** — in `DELETE /:id` after the soft-delete succeeds (status set to 'inactive'), remove it from the index:
```js
searchIndexer.removePart(parseInt(id, 10))
  .catch((e) => console.error('search index (remove) failed:', e.message));
```

- [ ] **Step 4: Verify by running** (manual smoke — server must be restarted, no hot-reload)

Start the backend, create a part via the UI/API, then:
```bash
curl -s "http://localhost:4000/api/v1/search?q=<word from the new part>" -H "Authorization: Bearer <token>"
```
Expected: the new part appears in `results` without running the backfill.

- [ ] **Step 5: Commit**
```bash
git add backend/src/routes/parts.js
git commit -m "feat(search): index parts on create/update/delete"
```

---

## Task 13: Frontend — wire the search bar to /api/v1/search

**Files:**
- Create: `frontend/src/services/searchApi.ts`
- Modify: the existing search UI (confirm exact component during execution)

> Confirm the axios base instance in `frontend/src/services/api.ts` first; reuse it so the JWT interceptor applies. Match the existing search bar's UX rather than adding a new page.

- [ ] **Step 1: API client**

`frontend/src/services/searchApi.ts`:
```ts
import api from './api'; // the configured axios instance with the JWT interceptor

export interface SearchHit {
  part_id: number;
  name: string;
  description?: string;
  manufacturer_part_number?: string;
  internal_part_number?: string;
  quantity?: number;
  location?: string;
  citation: { type: string; id: number; href: string };
}

export interface SearchResponse {
  results: SearchHit[];
  degraded: string[] | null;
  queryTimeMs: number;
}

export async function searchParts(q: string, limit = 10): Promise<SearchResponse> {
  const { data } = await api.get('/search', { params: { q, limit } });
  return data;
}
```
> If `api.ts` exports a non-default client or a different base path (`/api/v1` vs `/`), adjust the import + path to match.

- [ ] **Step 2: Wire into the existing search bar** — locate the parts search input, call `searchParts(q)` (debounced), render `results` as a dropdown/list where each row links to `hit.citation.href`. If `degraded` is non-null, show a subtle "limited results" hint. Keep the existing exact-filter behavior available as a fallback.

- [ ] **Step 3: Verify** — `cd frontend && npm run build` succeeds; manually search a fuzzy phrase and confirm ranked results link to the right parts.

- [ ] **Step 4: Commit**
```bash
git add frontend/src/services/searchApi.ts <modified search component>
git commit -m "feat(search): wire search bar to hybrid search endpoint"
```

---

## Task 14: End-to-end verification + write-up

**Files:** Create `docs/superpowers/notes/2026-06-20-rag-search-what-broke.md`

- [ ] **Step 1: Full-stack smoke** — backend running, `npm run search:reindex` done; from the UI run: (a) an exact part number, (b) a partial code, (c) a fuzzy description that doesn't contain the exact words. Confirm relevant parts rank well and links work.

- [ ] **Step 2: Degradation check** — temporarily rename the embedder model id to a bad value, restart, confirm search still returns lexical-only results with `degraded: ["vector"]`, then revert.

- [ ] **Step 3: Write up what broke** — capture the real failures hit during build (pgvector install, transformers.js API shape, model latency, FTS tokenization of codes, etc.) in the notes file. This is an explicit deliverable from the source brief.

- [ ] **Step 4: Commit**
```bash
git add docs/superpowers/notes/2026-06-20-rag-search-what-broke.md
git commit -m "docs(search): end-to-end verification notes + failure write-up"
```

---

## Self-review (completed)

- **Spec coverage:** retrieval-only (Task 9 returns records, no LLM) ✓; local embeddings (Task 5) ✓; FTS+trigram lexical (Task 8) ✓; pgvector vector (Tasks 2, 8) ✓; RRF (Task 3) ✓; cross-encoder rerank in v1 (Tasks 6, 9) ✓; bounded module (file structure) ✓; tenant scoping + isolation test (Tasks 9, 10) ✓; layered graceful degradation (Task 9) ✓; query logging for future Evals (Task 10) ✓; Swagger (Task 10) ✓; backfill + incremental sync (Tasks 11, 12) ✓; frontend (Task 13) ✓; pgvector-first spike (Task 0) ✓; "what broke" write-up (Task 14) ✓.
- **Type/name consistency:** `rrfFuse`, `buildPartContent`, `contentHash`, `embed({isQuery})`, `reranker.score`, `lexicalSearch`/`vectorSearch({q,tenantId,limit})`, `indexPartById`/`removePart`/`reindexAll`, `search({q,tenantId,limit})` used consistently across tasks. Channel outputs are `{source_id}`; fusion consumes `{source_id}`; hydrate keys on `source_id`/`part_id` (equal for parts).
- **Placeholders:** none — every code/test/command step is concrete. The two intentionally adaptive spots (Task 0 fallback, Task 13 exact UI component) carry explicit "confirm during execution" instructions, not blanks.
