"use client";

import { useMemo } from "react";
import type { DiagramExample } from "@/content/books";
import { tokenize } from "@/lib/tokenize";
import { DiagramCanvas } from "./DiagramCanvas";

export function ExampleCard({ examples }: { examples: DiagramExample[] }) {
  const prepared = useMemo(() => examples.map((e) => ({ ...e, tokens: tokenize(e.sentence) })), [examples]);

  return (
    <details className="rounded-xl border border-sky-200 bg-sky-50/70 p-3">
      <summary className="cursor-pointer font-semibold text-sky-900">See an example</summary>
      <div className="mt-3 flex flex-col gap-4">
        {prepared.map((e) => (
          <figure key={e.sentence} className="flex flex-col gap-2">
            <figcaption className="font-book text-lg text-sky-950">{e.sentence}</figcaption>
            <DiagramCanvas nodes={e.nodes} tokens={e.tokens} readOnly />
          </figure>
        ))}
      </div>
    </details>
  );
}
