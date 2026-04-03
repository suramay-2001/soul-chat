import { lazy, Suspense, useEffect, useState } from "react";
import type { Language } from "@maa/shared";
import type { Message } from "../hooks/useChat";
import QuoteCard from "./QuoteCard";
import { t } from "../lib/i18n";

const MediaPanel = lazy(() => import("./MediaPanel"));

function RateLimitBanner({ retryAfterSec, language }: { retryAfterSec: number; language: Language }) {
  const [remaining, setRemaining] = useState(retryAfterSec);

  useEffect(() => {
    if (remaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining]);

  const s = t(language);

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-amber-50 border border-amber-200 px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-600 text-lg">⏳</span>
          <p className="text-sm font-medium text-amber-800">{s.rateLimitMsg}</p>
        </div>
        {remaining > 0 && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-amber-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all duration-1000 ease-linear"
                style={{ width: `${((retryAfterSec - remaining) / retryAfterSec) * 100}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-amber-700 font-medium">
              {remaining}s
            </span>
          </div>
        )}
        {remaining === 0 && (
          <p className="text-xs text-green-700 font-medium">
            {language === "bn" ? "আপনি আবার জিজ্ঞাসা করতে পারেন!" : language === "hi" ? "अब आप फिर से पूछ सकते हैं!" : "You can ask again now!"}
          </p>
        )}
      </div>
    </div>
  );
}

interface Props {
  message: Message;
  language: Language;
}

export default function ChatMessage({ message, language }: Props) {
  const isSadhak = message.role === "sadhak";
  const s = t(language);

  if (isSadhak) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-saffron/15 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-saffron-dark">
            {s.sadhak}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-deep-brown">{message.text}</p>
        </div>
      </div>
    );
  }

  if (message.error === "RATE_LIMITED" && message.retryAfterSec) {
    return <RateLimitBanner retryAfterSec={message.retryAfterSec} language={language} />;
  }

  if (message.error) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-red-50 border border-red-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-red-500 text-base">⚠</span>
            <p className="text-sm text-red-800">{message.error}</p>
          </div>
        </div>
      </div>
    );
  }

  const r = message.response;
  const isStreaming = message.streaming;

  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-3 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
        <p className="text-[11px] font-medium uppercase tracking-wider text-sage">
          {s.teachings}
        </p>

        {message.statusMessage && !message.text && (
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-saffron" />
            <p className="text-sm italic text-muted-brown">
              {message.statusMessage}
            </p>
          </div>
        )}

        {message.text && (
          <div className="prose-sm prose-stone text-sm leading-relaxed text-deep-brown whitespace-pre-line">
            {message.text}
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-saffron" />
            )}
          </div>
        )}

        {!isStreaming && r?.essence && (
          <p className="rounded-md bg-soft-gold/30 px-3 py-2 text-xs italic text-warm-brown">
            {r.essence}
          </p>
        )}

        {!isStreaming && r?.quotes && r.quotes.length > 0 && (
          <div className="space-y-2 pt-1">
            {r.quotes.map((q, i) => (
              <QuoteCard key={i} quote={q} />
            ))}
          </div>
        )}

        {!isStreaming && r?.citations && r.citations.length > 0 && (
          <div className="pt-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-brown">{s.sources}</p>
            <ul className="mt-1 space-y-0.5">
              {r.citations.map((c, i) => (
                <li key={i} className="text-[11px] text-muted-brown">
                  {c.book} — pp. {c.pages}
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isStreaming && r && (
          <Suspense fallback={<div className="h-8" />}>
            <MediaPanel photos={r.photos} videos={r.videos} bhajan={r.bhajan} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
