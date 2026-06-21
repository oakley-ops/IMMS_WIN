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

## Done since (frontend + live verification)
- **Frontend wired.** The orphaned `components/PartSearch.tsx` (it fetched ALL parts and
  filtered client-side with `.includes()`, and referenced the dropped `internal_part_number`)
  was rewritten to call the hybrid endpoint via `services/searchApi.ts`, and mounted as a
  "Smart Search" panel above the existing list on the Parts page (`pages/Parts.tsx`, `/` route,
  additive — feature parity kept). The search hydrate was enriched to return the card fields
  (`minimum_quantity`, `unit_cost`, `supplier`, `image_url`). `tsc --noEmit`: 0 errors.
- **HTTP route verified live** (ran on port 4099 with a minted JWT): authed
  `GET /api/v1/search?q=bearing` → 200, `degraded:null`, ranked results with enriched fields;
  unauthenticated → 401. Note: `index.js` remounts routes but imports `./src/app`, so the
  `/api/v1/search` mount there is what serves.

## Done since (browser E2E; pgvector trial → reverted to native)
- **Browser E2E** verified: Smart Search on `/parts` returns ranked results in the real UI (screenshot delivered).
- **Tried pgvector via Docker, then reverted to native — on purpose.** A `pgvector/pgvector:pg17` container was stood up and the DB migrated in (pg_dump/restore, 619 parts), proving the pgvector path works. But pointing the *app* at the container decoupled it from the native 3-2-1 backups/DR and added a Docker runtime dependency — the wrong trade for a system whose data + DR live on the native PG, especially since at ~600 parts the `real[]` brute-force scan is already single-digit ms (pgvector's ANN index only matters at much larger scale). **Decision: keep the app on the native PG** and make the code **adaptive** — `vectorMode.js` detects pgvector and uses `vector(384)`+HNSW kNN when present, else `real[]` brute-force cosine. The container is stopped (kept, auto-restart off) as an optional dev/demo of the ANN path; `.env` is back on native. Verified on native end-to-end (exact + semantic, `degraded:null`); all 9 tests pass.
- **Demo wired:** `seedDemo.js` rebuilds the Smart Search index after each reseed (non-fatal), so the demo deployment ships with working Smart Search. `start-app.bat` left unchanged (no container dependency).

## Still open (optional / future)
- Phase-2 corpus: work-order notes, then PDF chunking with page-level citations.
- pgvector "for real" comes free on a Linux/Docker deploy (`apt install`/the container image) — the adaptive code uses it automatically there, no change needed.
