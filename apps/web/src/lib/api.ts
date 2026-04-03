import type { AskResponse, Language } from "@maa/shared";

export interface StreamCallbacks {
  onStatus?: (stage: string, message: string) => void;
  onToken?: (text: string) => void;
  onMeta?: (meta: AskResponse) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export interface RateLimitError {
  retryAfterSec: number;
  message: string;
}

export async function askQuestionStream(
  question: string,
  language: Language,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, language }),
    signal,
  });

  if (res.status === 429) {
    const retry = Number(res.headers.get("Retry-After") || "30");
    const err = new Error("RATE_LIMITED") as Error & { retryAfterSec: number };
    err.retryAfterSec = retry;
    throw err;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;

      let eventType = "";
      let eventData = "";

      for (const line of part.split("\n")) {
        if (line.startsWith("event: ")) eventType = line.slice(7).trim();
        else if (line.startsWith("data: ")) eventData += line.slice(6);
      }

      if (!eventType || !eventData) continue;

      let data: any;
      try {
        data = JSON.parse(eventData);
      } catch {
        continue;
      }

      switch (eventType) {
        case "status":
          callbacks.onStatus?.(data.stage, data.message);
          break;
        case "token":
          callbacks.onToken?.(data.text);
          break;
        case "meta":
          callbacks.onMeta?.(data as AskResponse);
          break;
        case "done":
          callbacks.onDone?.();
          break;
        case "error":
          callbacks.onError?.(data.message);
          break;
      }
    }
  }
}
