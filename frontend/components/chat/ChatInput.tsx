"use client";

import { useState, type KeyboardEvent } from "react";

export function ChatInput({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex items-end gap-2 border-t p-2">
      <textarea
        className="flex-1 resize-none rounded border p-2 text-sm"
        rows={1}
        placeholder="Ask about a garland…"
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        className="rounded bg-leaf px-3 py-2 text-sm text-white disabled:opacity-50"
        disabled={disabled}
        onClick={submit}
      >
        Send
      </button>
    </div>
  );
}
