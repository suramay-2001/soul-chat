-- Run once against your database (requires pgvector installed on the server).
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    s3_key TEXT NOT NULL UNIQUE,
    s3_etag TEXT NOT NULL,
    title TEXT,
    page_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    text TEXT NOT NULL,
    UNIQUE (book_id, page_number)
);

CREATE INDEX IF NOT EXISTS idx_pages_book ON pages (book_id);

CREATE TABLE IF NOT EXISTS chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES books (id) ON DELETE CASCADE,
    page_id UUID NOT NULL REFERENCES pages (id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    text TEXT NOT NULL,
    token_count INT NOT NULL,
    embedding vector(3072) NOT NULL,
    UNIQUE (book_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_chunks_book ON chunks (book_id);
