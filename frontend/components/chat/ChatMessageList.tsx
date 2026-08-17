"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "@/hooks/useChatSession";
import { MarkdownLite } from "./MarkdownLite";

export function ChatMessageList({ messages, isLoading }: { messages: ChatMessage[]; isLoading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {messages.length === 0 && (
        <p className="text-sm text-gray-500">
          Namaste! Ask me about garlands for a wedding, pooja, or celebration.
        </p>
      )}
      {messages.map((m) => (
        <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              m.role === "user" ? "bg-marigold text-white" : "bg-jasmine text-leaf"
            }`}
          >
            <MarkdownLite text={m.text} />
          </div>
        </div>
      ))}
      {isLoading && (
        <div className="flex justify-start">
          <div className="rounded-lg bg-jasmine px-3 py-2 text-sm text-leaf">Pooja is typing…</div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
