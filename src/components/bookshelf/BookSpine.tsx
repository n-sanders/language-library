"use client";

import { motion } from "framer-motion";
import type { Book } from "@/content/books";

export function BookSpine({ book, onOpen }: { book: Book; onOpen: () => void }) {
  const { color, accent, height, width } = book.spine;

  return (
    <motion.button
      type="button"
      layoutId={`book-${book.slug}`}
      onClick={onOpen}
      aria-label={`Open ${book.title}`}
      whileHover={{ y: -14 }}
      whileTap={{ y: -6 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="relative flex shrink-0 cursor-pointer flex-col items-center justify-between rounded-t-sm py-4 shadow-[inset_-6px_0_10px_rgba(0,0,0,0.35),inset_4px_0_6px_rgba(255,255,255,0.15)] focus-visible:outline-4 focus-visible:outline-amber-300"
      style={{ width, height, backgroundColor: color }}
    >
      <span className="h-1.5 w-4/5 rounded-full" style={{ backgroundColor: accent }} />
      <span
        className="spine-text font-book text-lg font-bold tracking-wide whitespace-nowrap"
        style={{ color: accent }}
      >
        {book.title}
      </span>
      <span className="flex w-4/5 flex-col gap-1">
        <span className="h-1 rounded-full" style={{ backgroundColor: accent }} />
        <span className="h-1 rounded-full" style={{ backgroundColor: accent }} />
      </span>
    </motion.button>
  );
}
