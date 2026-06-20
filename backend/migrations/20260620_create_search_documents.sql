-- Hybrid search index for parts (RAG retrieval). See
-- docs/superpowers/specs/2026-06-20-imms-rag-hybrid-parts-search-design.md
--
-- NOTE: pgvector is unavailable on this PostgreSQL (17.4, EDB Windows), so the
-- embedding column is real[] and cosine is computed in SQL (vectors are
-- L2-normalized, so cosine == dot product). Swap to vector(384) + HNSW when
-- pgvector is installed. Applied via src/scripts/createSearchDocumentsTable.js
-- (the numbered .sql files in this folder are applied by hand, not by run-migrations.js).
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS search_documents (
  id            bigserial PRIMARY KEY,
  tenant_id     int  NOT NULL DEFAULT 1 REFERENCES auth.tenants(tenant_id),
  source_type   text NOT NULL,
  source_id     int  NOT NULL,
  content       text NOT NULL,
  tsv           tsvector,
  embedding     real[],
  content_hash  text NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS search_documents_tsv_idx   ON search_documents USING GIN (tsv);
CREATE INDEX IF NOT EXISTS search_documents_scope_idx ON search_documents (tenant_id, source_type);
CREATE INDEX IF NOT EXISTS search_documents_trgm_idx  ON search_documents USING gin (content gin_trgm_ops);

COMMIT;
