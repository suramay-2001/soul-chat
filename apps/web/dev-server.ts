import { createServer, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isAllowedAudioUrl, isAllowedImageUrl } from "@maa/shared";

const envPath = resolve(import.meta.dirname, ".env.local");
try {
  const envFile = readFileSync(envPath, "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = val;
  }
} catch {}

const {
  embedQuery,
  searchChunks,
  buildMessages,
  selectMedia,
  validateInput,
  checkRateLimit,
  checkOpenAIRateLimit,
  sanitizeLLMOutput,
} = await import("@maa/retrieval");
const { DISCLAIMER } = await import("@maa/shared");
const { default: OpenAI } = await import("openai");

const PORT = 3001;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";
const MAX_BODY_BYTES = 4096;
const MAX_MEDIA_PROXY_BYTES = 25 * 1024 * 1024;
const ALLOWED_ORIGINS = new Set([
  "http://localhost:5173",
  "http://localhost:3000",
  process.env.ALLOWED_ORIGIN,
].filter(Boolean));

function sse(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");

  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === "GET" && req.url?.startsWith("/api/media")) {
    let target: string;
    try {
      const u = new URL(req.url, "http://127.0.0.1");
      target = u.searchParams.get("u") ?? "";
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Bad request" }));
    }
    if (!target || (!isAllowedImageUrl(target) && !isAllowedAudioUrl(target))) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Invalid or disallowed URL" }));
    }
    const ip = req.socket.remoteAddress ?? "unknown";
    const rl = checkRateLimit(ip);
    res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
    if (!rl.allowed) {
      res.setHeader("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
      res.writeHead(429, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Too many requests" }));
    }
    try {
      const upstream = await fetch(target, {
        redirect: "follow",
        headers: {
          "User-Agent": "MaaTeachings/1.0 (media proxy)",
          Accept: "*/*",
        },
      });
      if (!upstream.ok) {
        res.writeHead(502);
        return res.end();
      }
      const len = upstream.headers.get("content-length");
      if (len && Number(len) > MAX_MEDIA_PROXY_BYTES) {
        res.writeHead(413);
        return res.end();
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      if (buf.length > MAX_MEDIA_PROXY_BYTES) {
        res.writeHead(413);
        return res.end();
      }
      const ct =
        upstream.headers.get("content-type") ?? "application/octet-stream";
      res.writeHead(200, {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400",
      });
      return res.end(buf);
    } catch (e: unknown) {
      console.error("media proxy:", e instanceof Error ? e.message : e);
      res.writeHead(502);
      return res.end();
    }
  }

  if (req.method !== "POST" || req.url !== "/api/ask") {
    res.writeHead(404, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Not found" }));
  }

  const ip = req.socket.remoteAddress ?? "unknown";
  const rl = checkRateLimit(ip);
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    res.writeHead(429, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Too many requests. Please wait a moment." }));
  }

  let totalBytes = 0;
  const buffers: Buffer[] = [];
  for await (const chunk of req) {
    totalBytes += (chunk as Buffer).length;
    if (totalBytes > MAX_BODY_BYTES) {
      res.writeHead(413, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Request body too large." }));
    }
    buffers.push(chunk as Buffer);
  }

  let body: any;
  try {
    body = JSON.parse(Buffer.concat(buffers).toString());
  } catch {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error: "Invalid JSON body" }));
  }

  const { ok, sanitized, error } = validateInput(body?.question);
  if (!ok) {
    res.writeHead(400, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ error }));
  }

  const language = (body?.language === "bn" || body?.language === "hi") ? body.language : "en";

  const oaiRl = checkOpenAIRateLimit();
  if (!oaiRl.allowed) {
    res.writeHead(429, { "Content-Type": "application/json" });
    return res.end(
      JSON.stringify({ error: "Service is busy. Please try again in a moment." }),
    );
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  const t0 = Date.now();

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const safeLog = sanitized.slice(0, 50).replace(/[\n\r\t]/g, " ");
    console.log(`→ [${new Date().toISOString()}] "${safeLog}…"`);

    sse(res, "status", { stage: "searching", message: "Searching teachings…" });

    const tEmbed = Date.now();
    const embedding = await embedQuery(openai, sanitized, EMBED_MODEL);
    console.log(`  embed: ${Date.now() - tEmbed}ms`);

    const tSearch = Date.now();
    const results = await searchChunks(embedding, 5);
    console.log(`  search: ${Date.now() - tSearch}ms → ${results.length} chunks`);

    if (results.length === 0) {
      sse(res, "token", {
        text: "I could not find relevant teachings for your question. Please try rephrasing.",
      });
      sse(res, "meta", {
        answer:
          "I could not find relevant teachings for your question. Please try rephrasing.",
        essence: "",
        quotes: [],
        citations: [],
        photos: [],
        videos: [],
        bhajan: null,
        disclaimer: DISCLAIMER,
      });
      sse(res, "done", {});
      return res.end();
    }

    const messages = buildMessages(sanitized, results, language);

    sse(res, "status", { stage: "generating", message: "Reflecting on the teachings…" });

    const tLlm = Date.now();
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.4,
      max_completion_tokens: 1500,
      response_format: { type: "json_object" },
      stream: true,
    });

    let rawJson = "";
    let lastAnswerLen = 0;

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content;
      if (!token) continue;
      rawJson += token;

      // Progressively extract text inside the "answer" JSON value
      const m = rawJson.match(/"answer"\s*:\s*"((?:[^"\\]|\\.)*)("?)/s);
      if (m) {
        const unescaped = m[1]
          .replace(/\\n/g, "\n")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\");
        if (unescaped.length > lastAnswerLen) {
          sse(res, "token", { text: unescaped.slice(lastAnswerLen) });
          lastAnswerLen = unescaped.length;
        }
      }
    }
    console.log(`  llm: ${Date.now() - tLlm}ms (streamed)`);

    let rawParsed: any;
    try {
      rawParsed = JSON.parse(rawJson);
    } catch {
      rawParsed = { answer: rawJson, essence: "", quotes: [] };
    }
    const parsed = sanitizeLLMOutput(rawParsed);

    const citationMap = new Map<string, Set<number>>();
    for (const c of results) {
      const name =
        c.bookTitle || c.s3Key.replace("books/", "").replace(".pdf", "");
      if (!citationMap.has(name)) citationMap.set(name, new Set());
      citationMap.get(name)!.add(c.pageNumber);
    }
    const citations = [...citationMap.entries()].map(([book, pages]) => ({
      book,
      pages: [...pages]
        .sort((a: number, b: number) => a - b)
        .join(", "),
    }));

    const media = selectMedia();

    sse(res, "meta", {
      answer: parsed.answer,
      essence: parsed.essence,
      quotes: parsed.quotes,
      citations,
      photos: media.photos,
      videos: media.videos,
      bhajan: media.bhajan,
      disclaimer: DISCLAIMER,
    });

    sse(res, "done", {});
    console.log(`✓ total: ${Date.now() - t0}ms (streamed)`);
    res.end();
  } catch (err: any) {
    console.error("error:", err.message);
    sse(res, "error", { message: "Internal server error" });
    res.end();
  }
});

server.listen(PORT, () => {
  console.log(
    `\n  API dev server → http://localhost:${PORT}\n` +
      `    POST /api/ask   (SSE)\n` +
      `    GET  /api/media (image/audio proxy)\n`,
  );
});
