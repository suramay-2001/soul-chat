# Maa Anandmayee — Teachings Web App

A calm, conversational web app for exploring the wisdom of Maa Anandmayee,
grounded in her published books via RAG (retrieval-augmented generation).

## Architecture

```
apps/web/           React + Vite frontend  (Vercel-deployed)
  api/ask.ts        Vercel serverless endpoint
services/retrieval/ pgvector search, prompt assembly, media
packages/shared/    Shared TypeScript types
ingestion/          Python PDF → pgvector pipeline (separate)
```

## Prerequisites

- Node.js 18+
- The ingestion pipeline has already populated the Supabase/pgvector database
- An OpenAI API key with access to the embedding and chat models

## Local development

```bash
# From repo root:
npm install

# Copy and fill env vars:
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your real values

# Build workspace packages (once, or when they change):
npm run -w @maa/shared build && npm run -w @maa/retrieval build

# Terminal 1 — local API server (port 3001):
npm run -w @maa/web dev:api

# Terminal 2 — Vite frontend (port 5173, proxies /api → 3001):
npm run -w @maa/web dev
```

The Vite dev server runs at `http://localhost:5173` and proxies
`/api/*` requests to the local API server on port 3001.

> **Alternative:** You can also use Vercel CLI (`npx vercel dev` from
> `apps/web`) to run the serverless function locally instead of the
> custom dev-server.

## Deploy to Vercel

1. Import the repo to Vercel.
2. Set **Root Directory** to `apps/web`.
3. Add environment variables (see table below).
4. Deploy.

Vercel will auto-detect Vite and the `api/` serverless functions.

> **Important:** The RAG pipeline takes 12-17 seconds. Vercel **Hobby**
> plan has a 10-second function timeout. You need **Vercel Pro** ($20/mo)
> for the `maxDuration: 60` config in `api/ask.ts` to take effect.
>
> If using Supabase, set `DATABASE_URL` to the **connection pooler** URL
> (port 6543) to avoid connection exhaustion under concurrent load.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENAI_API_KEY` | Yes | — | OpenAI API key |
| `OPENAI_MODEL` | No | `gpt-4o` | Chat model for answer generation |
| `OPENAI_EMBED_MODEL` | No | `text-embedding-3-large` | Embedding model for queries |
| `DATABASE_URL` | Yes | — | PostgreSQL connection string (pgvector) |
| `RATE_LIMIT_RPM` | No | `100` | Per-IP requests per minute |
| `OPENAI_RATE_LIMIT_RPM` | No | `100` | Global OpenAI API calls per minute |
