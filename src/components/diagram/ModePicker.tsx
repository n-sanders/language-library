"use client";

import { useEffect, useState } from "react";
import { DIAGRAM_MODES, type DiagramMode } from "@/lib/diagram/types";

const MODE_INFO: Record<DiagramMode, { label: string; hint: string }> = {
  guided: { label: "Guided", hint: "The whole diagram is drawn. Drag each word to its spot." },
  supported: { label: "Supported", hint: "The main lines are drawn. Add the rest from the list, then place the words." },
  independent: { label: "Independent", hint: "Start from a blank page. Add every part yourself." },
};

const storageKey = (book: string, chapter: string) => `diagram-mode:${book}/${chapter}`;

/** The student's chosen mode for a chapter, remembered in this browser. */
export function useDiagramMode(book: string, chapter: string): [DiagramMode, (mode: DiagramMode) => void] {
  const [mode, setMode] = useState<DiagramMode>("guided");

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey(book, chapter));
    if (saved && (DIAGRAM_MODES as readonly string[]).includes(saved)) setMode(saved as DiagramMode);
  }, [book, chapter]);

  const choose = (next: DiagramMode) => {
    setMode(next);
    window.localStorage.setItem(storageKey(book, chapter), next);
  };
  return [mode, choose];
}

export function ModePicker({ mode, onChange, disabled }: { mode: DiagramMode; onChange: (mode: DiagramMode) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div role="radiogroup" aria-label="How much help" className="inline-flex self-start rounded-xl border border-amber-300 bg-amber-50 p-1">
        {DIAGRAM_MODES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            disabled={disabled}
            onClick={() => onChange(m)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${
              mode === m ? "bg-orange-800 text-white shadow" : "text-amber-900 hover:bg-amber-100"
            }`}
          >
            {MODE_INFO[m].label}
          </button>
        ))}
      </div>
      <p className="text-sm text-amber-800">{MODE_INFO[mode].hint}</p>
    </div>
  );
}
