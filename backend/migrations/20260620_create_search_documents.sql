-- Hybrid search index for parts (RAG retrieval). See
-- docs/superpowers/specs/2026-06-20-imms-rag-hybrid-parts-search-design.md
--
-- Adaptive: if pgvector is available, embedding is vector(384) with an HNSW cosine
-- index; otherwise it is real[] and cosine is computed in SQL (brute force). The app
-- code (vectorMode.js) picks the matching query path at runtime. Applied via
-- src/scripts/createSearchDocumentsTable.js.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

DO $do$
DECLARE has_vector boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM pg_available_extensions WHERE name = 'vector') INTO has_vector;
  IF has_vector THEN
    CREATE EXTENSION IF NOT EXISTS vector;
    EXECUTE $sql$
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
      )$sql$;
    EXECUTE 'CREATE INDEX IF NOT EXISTS search_documents_vec_idx ON search_documents USING hnsw (embedding vector_cosine_ops)';
  ELSE
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
  END IF;
END
$do$;

CREATE INDEX IF NOT EXISTS search_documents_tsv_idx   ON search_documents USING GIN (tsv);
CREATE INDEX IF NOT EXISTS search_documents_scope_idx ON search_documents (tenant_id, source_type);
CREATE INDEX IF NOT EXISTS search_documents_trgm_idx  ON search_documents USING gin (content gin_trgm_ops);

COMMIT;
