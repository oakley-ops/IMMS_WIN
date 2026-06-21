# Unify Parts Search — one smart search in the table

- **Date:** 2026-06-21
- **Status:** Approved design, pending spec review → implementation plan
- **Branch:** `feat/unify-parts-search`
- **Builds on:** the hybrid parts search shipped in PR #15 (`docs/superpowers/specs/2026-06-20-imms-rag-hybrid-parts-search-design.md`).

## Problem

The Parts page now has **two search boxes**:
1. The table's own search ("Search by name, part number, location…") — sends `?search=` to `GET /api/v1/parts`, which does a SQL `ILIKE` substring filter with pagination. Server-side, but a dumb substring match.
2. The added **"Smart Search"** panel above the table — the hybrid search (FTS + vector + RRF + cross-encoder rerank), rendered as cards.

Two search inputs on one page is redundant and confusing. The Smart Search panel was deliberately shipped as an additive panel in v1 to avoid touching the complex `PartsList`. Now we consolidate to **one** smart search that lives in the table the user already uses.

## Decision

**Option A — backend delegation.** Make the table's existing search box smart by upgrading the `GET /api/v1/parts` search path to use the hybrid search module, returning parts in the table's existing shape (ranked by relevance). Remove the separate Smart Search panel. Chosen over having the frontend call `/api/v1/search` directly (Option B) because it makes the existing box smarter with the least churn and keeps the table's columns / sort / pagination / row actions intact.

## Non-goals

- No new corpus (Phase-2 — documents / work orders — is held).
- No change to the search algorithm itself (channels, RRF, rerank unchanged).
- `/api/v1/search` stays as-is (still used by nothing else now, but kept as the bounded module's public API).

## Architecture & data flow

```
Parts table search box ──?search=q──▶ GET /api/v1/parts
                                          │  q present?
                            ┌─────────────┴───────────────┐
                           yes                            no
                            ▼                              ▼
              searchService.rankPartIds(q, tenant)   existing paginated
              → ordered part_id[] (cap ~100)          ILIKE list (unchanged)
                            │
              page-slice the ids → SELECT parts (existing table shape)
              WHERE part_id = ANY(ids)  ORDER BY (rank)
                            │  (on any error)
                            └────── fall back to existing ILIKE query
                            ▼
              { items, total: ids.length, page, limit, totalPages }
```

## Backend changes (`backend/`)

1. **`src/services/search/searchService.js` — extract ranking.** Today `search()` runs channels → RRF → rerank → hydrate (cards). Extract the rank portion into an exported `rankPartIds({ q, tenantId, limit })` that returns an ordered `part_id[]` (lexical + vector → RRF → cross-encoder rerank, **no** card hydration). `search()` is refactored to call `rankPartIds()` then hydrate — behavior unchanged for the existing `/api/v1/search` route.
2. **`src/routes/parts.js` — GET `/` search path.** When `req.query.search` is non-empty:
   - `tenantId = currentTenantId(req)`.
   - `ids = await rankPartIds({ q, tenantId, limit: 100 })`.
   - Page-slice `ids` by `page`/`limit`; if empty slice → `{ items: [], total: ids.length, ... }`.
   - Run the **existing parts SELECT** (same columns the table expects) with `WHERE p.part_id = ANY($pageIds)`, then re-order rows to match `pageIds` order in JS.
   - Return `{ items, total: ids.length, page, limit, totalPages: ceil(total/limit) }`.
   - **Graceful fallback:** wrap in try/catch; on any error from the search module, fall through to the current `ILIKE` query (search must never hard-fail). Log the fallback.
   - No `search` → current behavior, untouched.

## Frontend changes (`frontend/`)

1. **`src/pages/Parts.tsx`** — revert the `/` route to `<PartsList />` only (drop `<PartSearch />` and its import).
2. **`src/components/PartsList.tsx`** — update the search field placeholder to hint natural-language search (e.g. *"Search by description, part number, or what it's used for…"*). When `searchTerm` is non-empty, **disable manual column sort** (results are in relevance order); re-enable when the box is cleared. The existing fetch (`/api/v1/parts?search=`) is unchanged — it now receives ranked results.
3. **Retire `src/components/PartSearch.tsx`** (orphaned again once the panel is removed). Keep `src/services/searchApi.ts` only if still referenced; otherwise remove it.

## Edge cases / decisions

- **Ranked cap:** top 100 by relevance; pagination is over that set (`total` = ranked count). Beyond 100 hits, refine the query — acceptable for a lookup.
- **Sort during search:** disabled (relevance order); restored when the query is cleared.
- **Tenant scoping:** the search path is tenant-scoped (an improvement); the browse path keeps current behavior.
- **Empty/short query:** no search → normal list.
- **Fallback:** search-module error → existing `ILIKE` list, logged. Parity preserved.

## Testing

- **Unit (jest, mocked):** `rankPartIds` returns fused+reranked ids (reuse the `searchService` mock pattern — mock channels/reranker). `search()` still returns the same hydrated shape after the refactor.
- **Integration (jest, real DB):** `GET /api/v1/parts?search=<term>` returns the expected part ranked first; tenant isolation holds; when `rankPartIds` is stubbed to throw, the route falls back to `ILIKE` and still returns rows.
- **Frontend:** `tsc --noEmit` clean; manual/E2E — one search box, typing returns ranked parts in the table, clearing restores the full list + sort.

## Files

```
backend/src/services/search/searchService.js   # extract rankPartIds; search() reuses it
backend/src/routes/parts.js                    # GET / search path -> ranked ids -> table shape (+ fallback)
backend/__tests__/unit/search/searchService.test.js     # rankPartIds coverage
backend/__tests__/integration/search/parts-search.test.js # /api/v1/parts?search= ranked + fallback
frontend/src/pages/Parts.tsx                   # drop the Smart Search panel
frontend/src/components/PartsList.tsx           # placeholder + sort-disable-on-search
frontend/src/components/PartSearch.tsx          # delete (orphaned)
frontend/src/services/searchApi.ts             # delete if unreferenced
```
