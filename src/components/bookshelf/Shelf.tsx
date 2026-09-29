"use client";

import { LayoutGroup } from "framer-motion";
import { useState } from "react";
import type { Book } from "@/content/books";
import { BookSpine } from "./BookSpine";
import { OpenBook } from "./OpenBook";
import type { ShelfProgress } from "./progressKey";

export type { ShelfProgress };

/** Purely decorative spines so the shelf doesn't look empty. */
const DECOR = [
  { color: "#7f1d1d", height: 210, width: 38 },
  { color: "#44403c", height: 240, width: 30 },
  { color: "#78350f", height: 200, width: 44 },
];

export function Shelf({ books, progress }: { books: Book[]; progress: ShelfProgress }) {
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const openBook = books.find((b) => b.slug === openSlug);

  return (
    <LayoutGroup>
      <div className="w-full max-w-3xl">
        <div className="shelf-back relative flex h-80 items-end gap-1.5 rounded-t-md px-8 pt-6">
          <Decor spine={DECOR[0]} />
          {books.map((book) =>
            book.slug === openSlug ? (
              <div key={book.slug} style={{ width: book.spine.width }} className="shrink-0" />
            ) : (
              <BookSpine key={book.slug} book={book} onOpen={() => setOpenSlug(book.slug)} />
            ),
          )}
          <Decor spine={DECOR[1]} />
          <Decor spine={DECOR[2]} tilted />
        </div>
        <div className="shelf-board h-6 rounded-b-sm" />
      </div>

      {openBook && <OpenBook book={openBook} progress={progress} onClosed={() => setOpenSlug(null)} />}
    </LayoutGroup>
  );
}

function Decor({ spine, tilted = false }: { spine: (typeof DECOR)[number]; tilted?: boolean }) {
  return (
    <div
      aria-hidden
      className="shrink-0 rounded-t-sm opacity-80 shadow-[inset_-5px_0_8px_rgba(0,0,0,0.4)]"
      style={{
        width: spine.width,
        height: spine.height,
        backgroundColor: spine.color,
        transform: tilted ? "rotate(8deg) translateX(6px)" : undefined,
        transformOrigin: "bottom left",
      }}
    />
  );
}
