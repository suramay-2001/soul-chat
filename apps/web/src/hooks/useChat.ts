import { useCallback, useRef, useState } from "react";
import type { AskResponse, Language } from "@maa/shared";
import { askQuestionStream } from "../lib/api";

export interface Message {
  id: string;
  role: "sadhak" | "teaching";
  text: string;
  response?: AskResponse;
  error?: string;
  streaming?: boolean;
  statusMessage?: string;
  retryAfterSec?: number;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(async (question: string, language: Language) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "sadhak",
      text: question,
    };

    const botId = crypto.randomUUID();
    const botMsg: Message = {
      id: botId,
      role: "teaching",
      text: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, botMsg]);
    setLoading(true);

    let answerText = "";

    const update = (patch: Partial<Message>) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === botId ? { ...m, ...patch } : m)),
      );

    try {
      await askQuestionStream(
        question,
        language,
        {
          onStatus: (_stage, message) => {
            update({ statusMessage: message });
          },
          onToken: (text) => {
            answerText += text;
            update({ text: answerText, statusMessage: undefined });
          },
          onMeta: (meta) => {
            update({
              text: meta.answer || answerText,
              response: meta,
              streaming: false,
              statusMessage: undefined,
            });
          },
          onError: (error) => {
            update({ error, streaming: false, statusMessage: undefined });
          },
          onDone: () => {
            update({ streaming: false });
          },
        },
        ac.signal,
      );
    } catch (err: any) {
      if (err.name === "AbortError") return;
      if (err.message === "RATE_LIMITED") {
        update({
          error: "RATE_LIMITED",
          retryAfterSec: err.retryAfterSec ?? 30,
          streaming: false,
          statusMessage: undefined,
        });
      } else {
        update({
          error: err.message || "Something went wrong. Please try again.",
          streaming: false,
          statusMessage: undefined,
        });
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
  }, []);

  return { messages, loading, send, clear };
}
