# Hybrid Search over Parts (RAG retrieval) — Design

- **Date:** 2026-06-20
- **Status:** Approved design, pending spec review → implementation plan
- **Branch:** `feat/rag-hybrid-parts-search`
- **Source brief:** "IMMS + AI Engineering Skills" plan, skill #1 (RAG — Hybrid Search). This spec implements a tightly-scoped v1 of that skill.

## Context & problem

Finding a part in IMMS today means knowing an exact part number or scrolling tables. Techs and operators search in fuzzy descriptions ("that fitting we used on the Beckhoff job") as often as exact SKUs. We want a search that handles **both**: exact/partial codes *and* natural-language descriptions, ranked together, surfaced in the existing search affordance with a link back to each source record.

This is also IMMS's **first** AI/ML integration — there is currently no embeddings provider, no vector store, no LLM in the stack. The design treats that honestly: everything here is net-new, built to reuse existing infra (pg pool, JWT, `tenantScope`, `logger`) rather than claiming reuse that doesn't exist.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Feature | Hybrid search (RAG retrieval) | Most demonstrable + day-to-day useful; strong retrieval-engineering story |
| Output shape | **Retrieval-only** — ranked source records + citations | No LLM in the request path: zero per-query cost, no hallucination, no streaming/timeout concerns. All engineering depth is in retrieval. |
| Embeddings | **Local / self-hosted** via `transformers.js` (ONNX), `bge-small-en-v1.5` (384-dim) | $0 ongoing, no API key, fully offline, shop data never leaves the box. Runs in the existing Node backend. |
| Reranker | **Cross-encoder, in v1** (local, ONNX) | Meaningfully better ordering than fusion alone; "cross-encoder reranking" is a deliberate part of the scope. |
| Boundary | **Bounded module** in IMMS backend (`backend/src/services/search/`), own table, own route | Indexer needs direct DB access to source tables; least overhead; drawn so it can be extracted to a service later. |
| Corpus (v1) | **Parts only** | Core corpus, lowest effort, highest daily value. Other sources are phase-2 with no architecture change. |
| Multi-tenancy | Tenant-scoped on every read + index row | `tenant_id` is `NOT NULL` on every domain table (SaaS rollout); search must not leak across tenants. |

## Non-goals (v1)

- No LLM-generated answers (retrieval-only). Generative RAG is phase-2 and is when Guardrails (#6) becomes worth pairing.
- No work-order, PDF, or machine indexing in v1 (phase-2 — same architecture, more `source_type`s).
- No new microservice/process, no Redis, no external embedding/rerank APIs.
- No bespoke search UI redesign — integrate into the existing search affordance.

## Architecture & boundary

A self-contained module exposed via one route, backed by its own table in the existing Postgres. Nothing in parts/PO/WO controllers imports *from* search; search reads source tables read-only. This keeps it extractable into a standalone read-service later without untangling dependencies.

```
GET /api/v1/search?q=...  ──▶ searchController (JWT + tenant from auth context)
                                 │
              ┌──────────────────┼───────────────────────┐
              ▼                                            ▼
        lexicalSearch()                              vectorSearch()
   Postgres FTS (ts_rank_cd)                    embedder.embed(query)  ──┐
   + pg_trgm on code columns                    pgvector kNN (<=>)       │ transformers.js
              │                                            │             │  (in-process,
              └──────────────► rrfFuse() ◄────────────────┘             │   models held in RAM)
                                   │ top-K candidates                     │
                                   ▼                                      │
                              reranker.score(query, candidate.content) ◄──┘  cross-encoder
                                   │ reorder
                                   ▼
                          top-N ──▶ hydrate from parts ──▶ results + citations
```

Module layout:

```
backend/src/services/search/
  embedder.js          # transformers.js bi-encoder (query/doc), lazy-loaded singleton
  reranker.js          # transformers.js cross-encoder, lazy-loaded singleton
  searchIndexer.js     # upsertPart / removePart / reindexAll (content assembly + embed + write)
  lexicalSearch.js     # FTS + pg_trgm query
  vectorSearch.js      # pgvector kNN query
  rrf.js               # pure reciprocal-rank-fusion (no I/O)
  searchService.js     # orchestrates: channels → RRF → rerank → hydrate
backend/src/routes/search.js          # GET /api/v1/search (Swagger-documented)
backend/migrations/<ts>_create_search_documents.sql
backend/src/scripts/reindexSearch.js  # npm run search:reindex
```

## Data model

One denormalized index table (not per-source) so fusion stays uniform when phase-2 sources arrive:

```sql
CREATE TABLE search_documents (
  id            bigserial PRIMARY KEY,
  tenant_id     int  NOT NULL REFERENCES auth.tenants(tenant_id),
  source_type   text NOT NULL,                  -- 'part' in v1
  source_id     int  NOT NULL,                  -- parts.part_id
  content       text NOT NULL,                  -- assembled searchable text
  tsv           tsvector,                       -- weighted: name/codes='A', description='B'
  embedding     vector(384),                    -- bge-small-en-v1.5
  content_hash  text NOT NULL,                  -- skip re-embedding when unchanged
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_type, source_id)
);

CREATE INDEX search_documents_tsv_idx   ON search_documents USING GIN (tsv);
CREATE INDEX search_documents_vec_idx   ON search_documents USING hnsw (embedding vector_cosine_ops);
CREATE INDEX search_documents_scope_idx ON search_documents (tenant_id, source_type);
```

**Content assembly (parts):** join non-null fields into `content`, e.g.
`"{name}\n{description}\nMPN: {manufacturer_part_number}\nPN: {internal_part_number}\nSupplier: {supplier}\nLocation: {location}"`.
`tsv = setweight(to_tsvector('english', name||' '||codes), 'A') || setweight(to_tsvector('english', description||...), 'B')`.

At a few-thousand-row corpus HNSW is optional (flat scan is fine) but it is the correct default and free to add.

## Indexing pipeline

- **Embedder** (`embedder.js`): `transformers.js` loading `Xenova/bge-small-en-v1.5` (384-dim), lazy singleton held in memory (backend runs as plain `node`, no hot-reload — model loads once per process). bge is **asymmetric**: documents embedded raw; queries embedded with the prefix `"Represent this sentence for searching relevant passages:"`.
- **Backfill** (`npm run search:reindex`): batch-embed all parts per tenant; idempotent via `content_hash`.
- **Incremental sync** (`searchIndexer.upsertPart/removePart`): called from the parts service layer on create/update/delete. Local embedding of one row is milliseconds, so this is synchronous; `content_hash` skips the embed when text is unchanged.
- *Alternative considered:* event-driven via existing Socket.io parts events — rejected for v1 as indirection; a direct service-layer hook is simpler and synchronous.

## Query pipeline (core)

1. **Two channels in parallel:**
   - **Lexical** (`lexicalSearch.js`): Postgres FTS (`ts_rank_cd` over `tsv`) **plus** a `pg_trgm` similarity pass on `internal_part_number` / `manufacturer_part_number` so partial/fuzzy *code* typing ranks well (the "techs type exact SKUs" path).
   - **Vector** (`vectorSearch.js`): embed query → `ORDER BY embedding <=> $vec` kNN (the "fuzzy description" path).
2. **Reciprocal Rank Fusion** (`rrf.js`): `score = Σ 1/(k + rank_i)`, `k≈60`. Rank-based → needs no score calibration between channels. Produces a fused candidate list.
3. **Cross-encoder rerank** (`reranker.js`): take the top-K fused candidates (K≈25), score each `(query, candidate.content)` pair with a local cross-encoder, reorder by relevance. Default model `Xenova/ms-marco-MiniLM-L-6-v2` (small, CPU-fast); `Xenova/bge-reranker-base` is the higher-quality/heavier swap. The reranker runs only on the shortlist, never the whole corpus — adds ~100–400ms on CPU, acceptable for a search box.
4. Return top-N (N≈10), **hydrate** from `parts`, attach a **citation** per hit: `part_id`, deep link (`/parts/:id`), and which channel(s)/field matched (so the UI can show *why* it matched).

**On "BM25":** true Okapi BM25 is not native to Postgres; `ts_rank_cd` is the honest approximation with zero new infra. ParadeDB / `pg_search` is the real-BM25 upgrade path if ever needed. Describe it accurately as "FTS-rank ≈ BM25," never claim literal BM25.

## Tenant scoping & auth

Endpoint sits behind existing JWT middleware. `tenant_id` is read from the authenticated context — **never** from the query string. Every lexical and vector query carries `WHERE tenant_id = $tenant`; index rows store it. A dedicated integration test asserts a query authenticated as tenant A never returns tenant B's rows. This is the non-negotiable invariant.

## Failure modes & graceful degradation

Search degrades, never hard-fails (mirrors the call-board "keeps running if inventory is down" ethos). Degradation is layered:

| Failure | Behavior |
|---|---|
| Reranker load/score error | Return RRF order; response flagged `degraded: "rerank"` |
| Embedder load/cold-start/query-embed error | **Lexical-only** results; `degraded: "vector"` |
| pgvector extension missing | Detected at startup; vector channel disabled, lexical-only, logged loudly |
| Stale index (part edited, embed not synced) | `content_hash` + `updated_at` skew detection; `search:reindex` repairs |
| Empty / very short query | Skip vector + rerank; prefix/trigram only |

The response always carries a `degraded` field (`null` when fully healthy) so the UI and logs can see when a channel was down.

## Observability (and the bridge to a future Evals phase)

Per query, `logger` records: total latency + per-stage latency (lexical / vector / fusion / rerank), per-channel hit counts, result count, `degraded` state, and the (tenant-scoped) query text. This is exactly the raw material a later **Evals (#4)** phase would mine — we lay that groundwork honestly instead of pretending request logging of AI queries already exists. The endpoint is documented in the existing Swagger setup.

## Frontend surfacing

A results view that calls `/api/v1/search` and renders ranked parts with their citation / deep-link, wired into the existing search affordance (not a new bespoke UI). Exact integration point to be confirmed against `frontend/src/services/api.ts` and the parts pages during planning; results show the matched field / channel so the user sees *why* each hit ranked.

## Testing strategy

- **Unit (pure logic, no DB):** RRF fusion ordering; parts→`content` assembler; query-prefix logic; rerank ordering on a known case; the degradation decision tree.
- **Integration (test DB):** index→query roundtrip returns the seeded part; tenant-isolation invariant; lexical-only fallback when the embedder is stubbed to throw; RRF-order fallback when the reranker is stubbed to throw.

## Dependencies & infra

- `@xenova/transformers` (or current `transformers.js` package) — bi-encoder + cross-encoder, ONNX runtime bundled. Two models held in memory (~100–300MB combined).
- `pgvector` Postgres extension; `pg_trgm` extension (ships with Postgres contrib).
- No new process, no external API, no key.

## Top risk — verify first

**pgvector must install on the Windows Postgres** — not bundled. The plan's first task is a ~15-minute spike: `CREATE EXTENSION vector;`. If it won't install cleanly, fallbacks (in priority): prebuilt Windows binary → build from source → (worst case, viable at this corpus size) store embeddings as `real[]` and compute cosine in SQL/JS. The approach is not blocked either way; confirm before building.

## Phasing

- **v1 (this spec):** parts; retrieval-only; local bi-encoder embeddings; FTS+trigram lexical; RRF; **cross-encoder rerank**; tenant-scoped; graceful degradation; query logging; Swagger; frontend integration.
- **Phase-2 (architecture unchanged — more `source_type`s / toggles):** work-order text → PDF chunking with page-level citations → optional generative answers (pair Guardrails #6 here) → Evals mined from the v1 query logs.

## Open questions

None blocking. Reranker default model (`ms-marco-MiniLM-L-6-v2` vs `bge-reranker-base`) can be finalized during the pgvector/latency spike.
