import { useCallback, useEffect, useRef, useState } from "react";
import type { Language } from "@maa/shared";
import Header from "./components/Header";
import Disclaimer from "./components/Disclaimer";
import ChatInput from "./components/ChatInput";
import ChatMessage from "./components/ChatMessage";
import EmptyState from "./components/EmptyState";
import LoadingDots from "./components/LoadingDots";
import { useChat } from "./hooks/useChat";

const STORAGE_KEY = "maa-lang";

function loadLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "bn" || stored === "hi") return stored;
  } catch {}
  return "en";
}

export default function App() {
  const { messages, loading, send, clear } = useChat();
  const [language, setLanguage] = useState<Language>(loadLanguage);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleLanguageChange = useCallback((lang: Language) => {
    setLanguage(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
  }, []);

  const handleSend = useCallback(
    (question: string) => send(question, language),
    [send, language],
  );

  return (
    <div className="flex h-dvh flex-col">
      <Header
        onClear={clear}
        language={language}
        onLanguageChange={handleLanguageChange}
      />
      <Disclaimer language={language} />

      <main className="flex flex-1 flex-col overflow-y-auto">
        {messages.length === 0 && !loading ? (
          <EmptyState onSend={handleSend} language={language} />
        ) : (
          <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} language={language} />
            ))}
            {loading && <LoadingDots />}
            <div ref={bottomRef} />
          </div>
        )}
      </main>

      <ChatInput onSend={handleSend} disabled={loading} language={language} />
    </div>
  );
}
