/**
 * Strip HTML/script tags from LLM output to prevent stored XSS.
 * React's JSX already escapes, but defense-in-depth at the API layer
 * protects any future consumer (mobile app, third-party integration).
 */
const TAG_RE = /<\/?[a-z][^>]*>/gi;

export function stripTags(text: string): string {
  return text.replace(TAG_RE, "");
}

export function sanitizeLLMOutput(parsed: {
  answer?: string;
  essence?: string;
  quotes?: Array<{ text?: string; source?: string; page?: number | null }>;
}): {
  answer: string;
  essence: string;
  quotes: Array<{ text: string; source: string; page: number | null }>;
} {
  return {
    answer: stripTags(String(parsed.answer ?? "")),
    essence: stripTags(String(parsed.essence ?? "")),
    quotes: Array.isArray(parsed.quotes)
      ? parsed.quotes.map((q: any) => ({
          text: stripTags(String(q.text ?? "")),
          source: stripTags(String(q.source ?? "")),
          page: typeof q.page === "number" ? q.page : null,
        }))
      : [],
  };
}
