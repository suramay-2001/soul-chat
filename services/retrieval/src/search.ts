import type { RetrievedChunk } from "@maa/shared";
import OpenAI from "openai";
import { getPool } from "./db.js";

/**
 * Minimum cosine similarity (0–1) for a chunk to be considered relevant.
 * Pushed into the SQL WHERE clause so Postgres filters before transferring rows.
 */
export const SIMILARITY_THRESHOLD = 0.25;

/**
 * The query uses pgvector's <=> (cosine distance) operator.
 * With an HNSW index on chunks.embedding, this is an ANN (approximate
 * nearest neighbor) scan — O(log n) instead of sequential.
 *
 * The WHERE clause filters by similarity threshold server-side,
 * avoiding transfer of irrelevant rows over the wire.
 */
const SEARCH_QUERY = `
  SELECT
    c.id::text,
    c.text,
    c.token_count  AS "tokenCount",
    c.chunk_index  AS "chunkIndex",
    b.title        AS "bookTitle",
    b.s3_key       AS "s3Key",
    p.page_number  AS "pageNumber",
    1 - (c.embedding <=> $1::vector) AS similarity
  FROM chunks c
  JOIN books  b ON c.book_id = b.id
  JOIN pages  p ON c.page_id = p.id
  WHERE 1 - (c.embedding <=> $1::vector) >= $3
  ORDER BY c.embedding <=> $1::vector
  LIMIT $2
`;

export async function embedQuery(
  client: OpenAI,
  text: string,
  model = "text-embedding-3-large",
): Promise<number[]> {
  const resp = await client.embeddings.create({ model, input: text });
  return resp.data[0].embedding;
}

export async function searchChunks(
  queryEmbedding: number[],
  limit = 5,
): Promise<RetrievedChunk[]> {
  const pool = getPool();
  const vecStr = `[${queryEmbedding.join(",")}]`;
  const { rows } = await pool.query(SEARCH_QUERY, [
    vecStr,
    limit,
    SIMILARITY_THRESHOLD,
  ]);
  return rows as RetrievedChunk[];
}
