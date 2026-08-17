"use client";

import { useState } from "react";
import { useChatSession } from "@/hooks/useChatSession";
import { ChatMessageList } from "./ChatMessageList";
import { ChatInput } from "./ChatInput";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const { messages, isLoading, error, send } = useChatSession();

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open && (
        <div className="mb-2 flex h-96 w-80 flex-col rounded-lg border bg-white shadow-xl">
          <div className="flex items-center justify-between rounded-t-lg bg-leaf px-3 py-2 text-white">
            <span className="font-semibold">Pooja — TRC Garlands</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat">
              ✕
            </button>
          </div>

          {lastAssistant?.escalated && (
            <div className="bg-marigold/20 px-3 py-2 text-xs text-leaf">
              Rush request? For fastest response, message us directly.
            </div>
          )}

          <ChatMessageList messages={messages} isLoading={isLoading} />

          {error && <p className="px-3 pb-1 text-xs text-red-600">{error}</p>}

          <ChatInput disabled={isLoading} onSend={send} />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-leaf text-2xl text-white shadow-lg"
        aria-label="Toggle chat"
      >
        💬
      </button>
    </div>
  );
}
