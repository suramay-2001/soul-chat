-- ═══════════════════════════════════════════════════════════════
-- Migration 001: HNSW vector index + Row-Level Security
-- Run once against your Supabase database.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. HNSW index for fast approximate nearest-neighbor search ──
-- This replaces the default sequential scan with a graph-based index.
-- Cosine distance operator: <=>
-- m=16, ef_construction=64 is a good default for ~50k–500k vectors.
CREATE INDEX IF NOT EXISTS idx_chunks_embedding_hnsw
  ON chunks
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── 2. Set the HNSW search probe depth for queries ──────────────
-- Higher ef_search = more accurate but slower. 40 is a good balance.
-- This is a session-level default; can be overridden per-query.
ALTER DATABASE postgres SET hnsw.ef_search = 40;

-- ── 3. Row-Level Security (RLS) ────────────────────────────────
-- Enable RLS on all tables. This ensures that even if the
-- Supabase anon key leaks, direct table access is locked down.

-- books: read-only for anon, full access for service_role
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
CREATE POLICY books_read_only ON books
  FOR SELECT
  USING (true);

-- pages: read-only for anon
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY pages_read_only ON pages
  FOR SELECT
  USING (true);

-- chunks: read-only for anon
ALTER TABLE chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY chunks_read_only ON chunks
  FOR SELECT
  USING (true);

-- INSERT/UPDATE/DELETE only via service_role (used by ingestion worker).
-- Supabase service_role bypasses RLS by default, so no explicit
-- write policies are needed for the ingestion pipeline.

-- ── 4. Revoke direct write access from anon role ───────────────
REVOKE INSERT, UPDATE, DELETE ON books  FROM anon;
REVOKE INSERT, UPDATE, DELETE ON pages  FROM anon;
REVOKE INSERT, UPDATE, DELETE ON chunks FROM anon;

-- ── 5. Analyze tables for query planner ────────────────────────
ANALYZE books;
ANALYZE pages;
ANALYZE chunks;
