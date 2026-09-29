"use client";

import type { LabelDef } from "@/content/books";

export function LabelPalette({
  labels,
  activeId,
  counts,
  onSelect,
  disabled,
}: {
  labels: LabelDef[];
  activeId: string;
  counts: Record<string, number>;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-amber-800">
        1. Pick what you&apos;re looking for &nbsp;·&nbsp; 2. Tap the words in the sentence
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {labels.map((label, i) => {
          const active = label.id === activeId;
          return (
            <button
              key={label.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(label.id)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition disabled:opacity-60 ${
                active ? "bg-white shadow-md" : "border-transparent bg-white/50 hover:bg-white"
              }`}
              style={{ borderColor: active ? label.color : undefined }}
            >
              <span className="flex w-full items-center gap-2">
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
                <span className="font-bold">{label.name}</span>
                <span className="ml-auto text-xs text-stone-500">
                  {counts[label.id] ? `${counts[label.id]} tagged` : `key ${i + 1}`}
                </span>
              </span>
              <span className="text-sm text-stone-600">{label.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
