import type { Language } from "@maa/shared";
import { t } from "../lib/i18n";

interface Props {
  onSend?: (q: string) => void;
  language: Language;
}

export default function EmptyState({ onSend, language }: Props) {
  const s = t(language);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 text-5xl opacity-60">🙏</div>
      <h2 className="font-serif-heading text-lg font-semibold text-deep-brown">
        {s.welcome}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-brown">
        {s.welcomeDesc}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {s.suggestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onSend?.(q)}
            className="rounded-full border border-soft-gold bg-white px-3 py-1.5 text-xs text-muted-brown transition hover:border-saffron-light hover:text-warm-brown"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}
