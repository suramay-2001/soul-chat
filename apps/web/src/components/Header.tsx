import type { Language } from "@maa/shared";
import { LANGUAGE_OPTIONS, t } from "../lib/i18n";

interface Props {
  onClear: () => void;
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export default function Header({ onClear, language, onLanguageChange }: Props) {
  const s = t(language);

  return (
    <header className="sticky top-0 z-10 border-b border-soft-gold/50 bg-cream/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-serif-heading text-xl font-semibold tracking-wide text-deep-brown">
            Maa Anandmayee
          </h1>
          <p className="text-xs text-muted-brown">Teachings &amp; Wisdom</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg border border-soft-gold/60 bg-white/60 p-0.5">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.code}
                onClick={() => onLanguageChange(opt.code)}
                title={opt.label}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  language === opt.code
                    ? "bg-saffron text-white shadow-sm"
                    : "text-muted-brown hover:text-warm-brown"
                }`}
              >
                {opt.nativeLabel}
              </button>
            ))}
          </div>

          <button
            onClick={onClear}
            className="rounded-lg px-3 py-1.5 text-xs text-muted-brown transition hover:bg-cream-dark hover:text-warm-brown"
          >
            {s.newConversation}
          </button>
        </div>
      </div>
    </header>
  );
}
