# Hybrid Parts Search — What Broke / Real-World Findings

Captured during implementation on 2026-06-20. The source brief explicitly asked for the
failure modes hit while building, not just the happy path. These are the real ones.

## 1. pgvector is not installed (and not trivially installable here)
- Spike (`pg_available_extensions`) showed `pg_trgm` available but **no `vector`** on
  PostgreSQL **17.4, EDB Windows build**. Enabling pgvector means an MSVC source build
  (`nmake`) — no prebuilt package for this distribution.
- **Resolution:** store the 384-dim embedding as `real[]` and compute cosine in SQL via
  `unnest(embedding, $query)` dot-product (embeddings are L2-normalized, so cosine == dot
  product). Brute-force scan over 592 rows is single-digit ms. The module is bounded so
  swapping to `vector(384)` + HNSW later is a column-type + one-query change.

## 2. `internal_part_number` doesn't exist (documentation drift)
- CLAUDE.md and `create_parts.sql` reference `internal_part_number`; the **live `parts`
  table has neither it nor `crc_part_number`** (rename→crc→drop migration history removed
  both). Only `manufacturer_part_number` and `barcode` remain as code fields.
- **Resolution:** content assembly, lexical code-matching, and hydrate use
  `manufacturer_part_number` + `barcode`; location is `COALESCE(part_locations.name, parts.location)`
  (both a legacy `location` varchar and a `location_id` FK exist). Verified against the live
  schema before writing queries, not from the docs.

## 3. @xenova/transformers is ESM → crashes jest's CJS transform
- `require('@xenova/transformers')` works fine under plain `node`, but under jest it throws
  `SyntaxError: Unexpected token 'export'` (the package is ESM; jest doesn't transform
  node_modules by default). This first surfaced as an auto-mock failure.
- **Resolution (testing split):**
  - **jest** covers pure logic (RRF, content assembly, orchestrator degradation) and an
    integration test that **stubs the embedder/reranker** to exercise the real tenant-scoped
    SQL path (lexical + vector + RRF + hydrate) — keeps the tenant-isolation invariant in CI.
  - **`node src/scripts/searchSmoke.js`** validates the **real** ONNX models end-to-end.

## 4. jest "did not exit" (shared pool open handle)
- The shared `db.js` pool keeps connections open after the integration test.
- **Resolution:** `await pool.end()` in `afterAll`. (Single integration file, so safe.)

## 5. Tenant FK requires a real tenant row
- `parts.tenant_id` and `search_documents.tenant_id` both FK `auth.tenants`, which only had
  tenant 1. The isolation test must create tenant 2 (`ON CONFLICT DO NOTHING`) before
  inserting a tenant-2 part, and clean it up after.

## 6. Two `router.post('/')` handlers in parts.js
- `parts.js` registers `POST /` twice — the first (authenticated, with `notifyInventoryChange`)
  wins; the second is dead/shadowed. The index hook was added to the **active** handler
  (plus `PUT /:id` and `DELETE /:id`). Bulk import (`POST /bulk`) is left to `search:reindex`.

## Retrieval quality (real data, 592 active parts indexed)
- "shaft bearing" → SHAFT BEARING (exact, both channels agree).
- "blade for peeling hotstamp" (no keyword overlap) → PEELER BLADE, Peeler Blade Sensor/guide
  (semantic vector + cross-encoder rerank doing the work).
- "green belt" → HOTSTAMP GREEN BELT, then other belts (semantic neighbors).
- `degraded: null` on all — full lexical + vector + rerank pipeline healthy.

## Still open
- **Frontend UI wiring** — typed client `frontend/src/services/searchApi.ts` is in place;
  surfacing it in the UI is the remaining step (placement is a UX decision; frontend
  component layout differs from the documented `pages/`+`components/` `.tsx` structure and
  needs mapping before a safe edit).
