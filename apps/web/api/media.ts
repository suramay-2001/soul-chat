import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isAllowedAudioUrl, isAllowedImageUrl } from "@maa/shared";
import { checkRateLimit } from "@maa/retrieval";

export const config = { maxDuration: 60 };

/** Max bytes to buffer (avoids OOM on Vercel; large files still work for typical MP3s). */
const MAX_BYTES = 25 * 1024 * 1024;

function clientIp(req: VercelRequest): string {
  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string") return realIp.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).end("Method not allowed");
  }

  const raw = req.query.u;
  const target = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  if (!target || (!isAllowedImageUrl(target) && !isAllowedAudioUrl(target))) {
    return res.status(400).json({ error: "Invalid or disallowed URL" });
  }

  const rl = checkRateLimit(clientIp(req));
  res.setHeader("X-RateLimit-Remaining", String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader("Retry-After", String(Math.ceil(rl.resetMs / 1000)));
    return res.status(429).end("Too many requests");
  }

  try {
    const upstream = await fetch(target, {
      redirect: "follow",
      headers: {
        "User-Agent": "MaaTeachings/1.0 (media proxy; +https://github.com)",
        Accept: "*/*",
      },
    });

    if (!upstream.ok) {
      return res.status(502).end("Upstream error");
    }

    const len = upstream.headers.get("content-length");
    if (len && Number(len) > MAX_BYTES) {
      return res.status(413).end("Resource too large");
    }

    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      return res.status(413).end("Resource too large");
    }

    const ct =
      upstream.headers.get("content-type") ?? "application/octet-stream";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    return res.status(200).send(buf);
  } catch (e: unknown) {
    console.error("media proxy:", e instanceof Error ? e.message : e);
    return res.status(502).end("Fetch failed");
  }
}
