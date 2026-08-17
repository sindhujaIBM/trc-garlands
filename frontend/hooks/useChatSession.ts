"use client";

import { useState, useCallback } from "react";
import { sendChatMessage } from "@/api/chat";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  escalated?: boolean;
}

// Backend is stateless per-turn today (ai-chat-handler always calls the
// model with history: []) — this hook keeps the full transcript for
// display, but only the newest message ever reaches Pooja. Known limitation,
// not a bug to fix here.
export function useChatSession() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", text };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await sendChatMessage({ sessionId, message: text });
        setSessionId(response.sessionId);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: response.reply,
            escalated: response.escalated,
          },
        ]);
      } catch {
        setError("Pooja's offline right now — message us directly and we'll get back to you.");
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  return { messages, isLoading, error, send };
}
