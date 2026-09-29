"use client";

import { useState } from "react";
import { MAX_CUSTOM_TOPIC_LENGTH, PRESET_TOPICS } from "@/content/topics";

export function TopicPicker({ onPick, disabled }: { onPick: (topic: string) => void; disabled?: boolean }) {
  const [custom, setCustom] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-book text-2xl font-bold">What should the sentence be about?</h2>
      <div className="flex flex-wrap gap-2">
        {PRESET_TOPICS.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(t.label)}
            className="rounded-full border-2 border-amber-300 bg-white px-4 py-2 text-lg font-semibold text-amber-900 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-500 hover:shadow disabled:opacity-50"
          >
            <span className="mr-1">{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (custom.trim()) onPick(custom.trim());
        }}
      >
        <span className="text-amber-800">Or type your own:</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          maxLength={MAX_CUSTOM_TOPIC_LENGTH}
          placeholder="volcanoes, soccer, penguins..."
          className="input min-w-0 flex-1"
          disabled={disabled}
        />
        <button type="submit" className="btn-primary" disabled={disabled || !custom.trim()}>
          Go
        </button>
      </form>
    </div>
  );
}
