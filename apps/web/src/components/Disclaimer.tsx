import type { Language } from "@maa/shared";
import { t } from "../lib/i18n";

export default function Disclaimer({ language }: { language: Language }) {
  const s = t(language);

  return (
    <div className="mx-auto max-w-3xl px-4 py-2">
      <p className="rounded-lg bg-soft-gold/30 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-brown">
        {s.disclaimer}
      </p>
    </div>
  );
}
