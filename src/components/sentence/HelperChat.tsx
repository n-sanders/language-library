"use client";

import { useEffect, useRef, useState } from "react";
import type { LabelDef } from "@/content/books";

type Message = { role: "user" | "assistant"; content: string };

export function HelperChat({
  exerciseId,
  labels,
  activeId,
  studentName,
}: {
  exerciseId: number | null;
  labels: LabelDef[];
  activeId: string;
  studentName: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = labels.find((l) => l.id === activeId) ?? labels[0];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || !exerciseId || busy) return;
    setInput("");
    setError(null);
    setBusy(true);
    setMessages((m) => [...m, { role: "user", content: message }, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseId, message, focusLabelId: activeId }),
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "The helper couldn't answer right now.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        });
      }
    } catch (err) {
      setMessages((m) => (m[m.length - 1]?.content === "" ? m.slice(0, -1) : m));
      setError(err instanceof Error ? err.message : "The helper couldn't answer right now.");
    } finally {
      setBusy(false);
    }
  };

  const suggestions = [
    `How do I find the ${active.name.toLowerCase()}?`,
    "Can I have a hint?",
    `What is a ${active.name.toLowerCase()}?`,
  ];

  return (
    <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3">
        <span className="text-3xl" aria-hidden>
          🦉
        </span>
        <div>
          <p className="font-bold">Professor Hoot</p>
          <p className="text-xs text-amber-800">Your grammar helper</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <Bubble role="assistant">
          {exerciseId
            ? `Hi ${studentName}! Stuck on the ${active.name.toLowerCase()}? Ask me and I'll help you figure it out.`
            : "Pick a topic to get a sentence, and I'll be here if you need help!"}
        </Bubble>
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role}>
            {m.content || <span className="animate-pulse">Thinking...</span>}
          </Bubble>
        ))}
        {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-800">{error}</p>}
      </div>

      {exerciseId && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => send(s)}
              className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-amber-100 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={500}
          disabled={!exerciseId || busy}
          placeholder={exerciseId ? "Ask a question..." : "Waiting for a sentence..."}
          className="input min-w-0 flex-1"
        />
        <button type="submit" className="btn-primary" disabled={!exerciseId || busy || !input.trim()}>
          Ask
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, children }: { role: Message["role"]; children: React.ReactNode }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3 py-2 whitespace-pre-wrap ${
          mine ? "rounded-br-sm bg-orange-700 text-white" : "rounded-bl-sm bg-amber-50 text-amber-950"
        }`}
      >
        {children}
      </div>
    </div>
  );
}
