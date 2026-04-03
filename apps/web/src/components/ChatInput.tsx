import { useState, type FormEvent } from "react";
import type { Language } from "@maa/shared";
import { MAX_QUESTION_LENGTH } from "@maa/shared";
import { t } from "../lib/i18n";

interface Props {
  onSend: (question: string) => void;
  disabled: boolean;
  language: Language;
}

export default function ChatInput({ onSend, disabled, language }: Props) {
  const [value, setValue] = useState("");
  const s = t(language);
  const charCount = value.length;
  const overLimit = charCount > MAX_QUESTION_LENGTH;
  const canSend = !disabled && value.trim().length > 0 && !overLimit;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q || disabled || overLimit) return;
    onSend(q);
    setValue("");
  }

  const pct = charCount / MAX_QUESTION_LENGTH;
  const counterColor =
    overLimit
      ? "text-red-600"
      : pct > 0.85
        ? "text-amber-600"
        : "text-muted-brown/50";

  return (
    <form
      onSubmit={handleSubmit}
      className="sticky bottom-0 border-t border-soft-gold/50 bg-cream/90 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={s.placeholder}
              rows={1}
              disabled={disabled}
              maxLength={MAX_QUESTION_LENGTH + 50}
              className={`w-full resize-none rounded-xl border px-4 py-2.5 pr-16 text-sm text-deep-brown placeholder:text-muted-brown/60 focus:outline-none disabled:opacity-50 ${
                overLimit
                  ? "border-red-400 bg-red-50/50 focus:border-red-500"
                  : "border-soft-gold bg-white focus:border-saffron"
              }`}
            />
            <span
              className={`absolute bottom-2.5 right-3 text-[10px] tabular-nums ${counterColor}`}
            >
              {charCount}/{MAX_QUESTION_LENGTH}
            </span>
          </div>
          <button
            type="submit"
            disabled={!canSend}
            className="shrink-0 rounded-xl bg-saffron px-5 py-2.5 text-sm font-medium text-white transition hover:bg-saffron-dark disabled:opacity-40"
          >
            {disabled ? "…" : s.askButton}
          </button>
        </div>
        {overLimit && (
          <p className="mt-1 text-[11px] text-red-600">
            {language === "bn"
              ? `প্রশ্নটি অনেক দীর্ঘ। অনুগ্রহ করে ${MAX_QUESTION_LENGTH} অক্ষরের মধ্যে রাখুন।`
              : language === "hi"
                ? `प्रश्न बहुत लंबा है। कृपया ${MAX_QUESTION_LENGTH} अक्षरों तक सीमित रखें।`
                : `Question too long. Please keep it under ${MAX_QUESTION_LENGTH} characters.`}
          </p>
        )}
      </div>
    </form>
  );
}
