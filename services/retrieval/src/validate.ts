import { MAX_QUESTION_LENGTH, MIN_QUESTION_LENGTH } from "@maa/shared";

function sanitize(text: string): string {
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim();
}

export interface ValidationResult {
  ok: boolean;
  sanitized: string;
  error?: string;
}

export function validateInput(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, sanitized: "", error: "Question must be a non-empty string." };
  }

  const sanitized = sanitize(raw);

  if (sanitized.length < MIN_QUESTION_LENGTH) {
    return { ok: false, sanitized, error: "Question is too short. Please ask a complete question." };
  }

  if (sanitized.length > MAX_QUESTION_LENGTH) {
    return {
      ok: false,
      sanitized,
      error: `Question is too long (${sanitized.length} characters). Please keep it under ${MAX_QUESTION_LENGTH} characters.`,
    };
  }

  return { ok: true, sanitized };
}
