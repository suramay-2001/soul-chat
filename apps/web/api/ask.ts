import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { Citation } from "@maa/shared";
import { DISCLAIMER } from "@maa/shared";
import {
  embedQuery,
  searchChunks,
  buildMessages,
  selectMedia,
  validateInput,
  checkRateLimit,
  checkOpenAIRateLimit,
  sanitizeLLMOutput,
} from "@maa/retrieval";
import OpenAI from "openai";

export const config = { maxDuration: 60 };

const MODEL = process.env.OPENAI_MODEL || "gpt-4o";
const EMBED_MODEL = process.env.OPENAI_EMBED_MODEL || "text-embedding-3-large";
const TOP_K = 5;

function clientIp(req: VercelRequest): string {
  // Vercel always sets x-real-ip to the actual client IP (cannot be spoofed).
  // Fall back to x-forwarded-for only if x-real-ip is absent.
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") return realIp.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

function setSecurityHeaders(res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

function sse(res: VercelResponse, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setSecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = clientIp(req);
  const rl = checkRateLimit(ip);
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    return res.status(429).json({ error: "Too many requests. Please wait a moment." });
  }

  const { ok, sanitized, error } = validateInput(req.body?.question);
  if (!ok) return res.status(400).json({ error });

  const language = (req.body?.language === "bn" || req.body?.language === "hi") ? req.body.language : "en";

  const oaiRl = checkOpenAIRateLimit();
  if (!oaiRl.allowed) {
    return res
      .status(429)
      .json({ error: "Service is busy. Please try again in a moment." });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    sse(res, "status", { stage: "searching", message: "Searching teachings…" });

    const embedding = await embedQuery(openai, sanitized, EMBED_MODEL);
    const chunks = await searchChunks(embedding, TOP_K);

    if (chunks.length === 0) {
      const fallback =
        "I could not find relevant teachings for your question. " +
        "The retrieved passages did not match closely enough. " +
        "Please try rephrasing or asking about a different aspect of Maa Anandmayee's wisdom.";
      sse(res, "token", { text: fallback });
      sse(res, "meta", {
        answer: fallback,
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

    const messages = buildMessages(sanitized, chunks, language);

    sse(res, "status", { stage: "generating", message: "Reflecting on the teachings…" });

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

    let rawParsed: any;
    try {
      rawParsed = JSON.parse(rawJson);
    } catch {
      rawParsed = { answer: rawJson, essence: "", quotes: [] };
    }
    const parsed = sanitizeLLMOutput(rawParsed);

    const citationMap = new Map<string, Set<number>>();
    for (const c of chunks) {
      const name =
        c.bookTitle || c.s3Key.replace("books/", "").replace(".pdf", "");
      if (!citationMap.has(name)) citationMap.set(name, new Set());
      citationMap.get(name)!.add(c.pageNumber);
    }
    const citations: Citation[] = [...citationMap.entries()].map(
      ([book, pages]) => ({
        book,
        pages: [...pages].sort((a, b) => a - b).join(", "),
      }),
    );

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
    res.end();
  } catch (err: any) {
    console.error("ask handler error:", err?.message ?? err);
    sse(res, "error", { message: "Internal server error" });
    res.end();
  }
}
