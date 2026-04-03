import type { Quote } from "@maa/shared";

export default function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <blockquote className="border-l-2 border-saffron-light pl-3 text-sm italic text-warm-brown">
      <p>"{quote.text}"</p>
      <footer className="mt-1 text-xs not-italic text-muted-brown">
        — {quote.source}
        {quote.page != null && `, p. ${quote.page}`}
      </footer>
    </blockquote>
  );
}
