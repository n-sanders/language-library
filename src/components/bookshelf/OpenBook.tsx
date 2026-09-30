"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Book } from "@/content/books";
import { formatPercent } from "@/lib/format";
import { progressKeyOf, type ShelfProgress } from "./progressKey";

type Size = { pageWidth: number; pageHeight: number; narrow: boolean };

function measure(): Size {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const narrow = vw < 700;
  const pageWidth = narrow ? Math.min(vw - 32, 420) : Math.min(380, Math.floor((vw - 64) / 2));
  const pageHeight = Math.min(Math.round(pageWidth * 1.4), vh - 96);
  return { pageWidth, pageHeight, narrow };
}

export function OpenBook({
  book,
  progress,
  onClosed,
}: {
  book: Book;
  progress: ShelfProgress;
  onClosed: () => void;
}) {
  const [size, setSize] = useState<Size>(() => measure());
  const [open, setOpen] = useState(false);
  const openRef = useRef(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onResize = () => setSize(measure());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    openRef.current = true;
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const { pageWidth, pageHeight, narrow } = size;
  const { color, accent } = book.spine;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.4 }}
        onClick={close}
      />
      <div
        className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
        style={{ perspective: 2400 }}
      >
        <motion.div
          initial={{ x: 0 }}
          animate={{ x: open && !narrow ? pageWidth / 2 : 0 }}
          transition={{ duration: 0.8, delay: open ? 0.55 : 0, ease: "easeInOut" }}
          className="pointer-events-auto"
        >
          <motion.div
            layoutId={`book-${book.slug}`}
            transition={{ type: "spring", stiffness: 140, damping: 22 }}
            className="preserve-3d relative rounded-r-md shadow-[0_30px_60px_rgba(0,0,0,0.5)]"
            style={{ width: pageWidth, height: pageHeight }}
            role="dialog"
            aria-modal="true"
            aria-label={book.title}
          >
            <div className="book-page absolute inset-0 overflow-y-auto rounded-r-md p-6">
              <TableOfContents book={book} progress={progress} />
            </div>

            <motion.div
              className="preserve-3d absolute inset-0"
              style={{ transformOrigin: "left center" }}
              initial={{ rotateY: 0 }}
              animate={{ rotateY: open ? -180 : 0 }}
              transition={{ duration: 0.9, delay: open ? 0.55 : 0, ease: [0.45, 0.05, 0.3, 1] }}
              onAnimationComplete={() => {
                if (openRef.current) closeRef.current?.focus();
                else onClosed();
              }}
            >
              <div
                className="backface-hidden absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-r-md p-8 text-center shadow-[inset_8px_0_14px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: color }}
              >
                <div className="absolute inset-3 rounded border-2" style={{ borderColor: accent }} />
                <h2 className="font-book text-4xl font-bold" style={{ color: accent }}>
                  {book.title}
                </h2>
                <p className="font-book text-lg italic" style={{ color: accent }}>
                  {book.subtitle}
                </p>
              </div>
              <div
                className="backface-hidden book-page-left absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-l-md p-8 text-center"
                style={{ transform: "rotateY(180deg)", opacity: narrow ? 0 : 1 }}
              >
                <p className="text-sm tracking-[0.3em] text-amber-700 uppercase">This book belongs to the</p>
                <p className="font-book text-3xl font-bold text-amber-950">Language Library</p>
                <div className="my-2 h-px w-2/3 bg-amber-300" />
                <p className="font-book text-2xl text-amber-900">{book.title}</p>
                <p className="font-book text-amber-800 italic">{book.subtitle}</p>
              </div>
            </motion.div>

            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Put the book back"
              className="absolute -top-4 -right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-900 shadow-lg hover:bg-amber-200"
              style={{ transform: "translateZ(2px)" }}
            >
              ×
            </button>
          </motion.div>
        </motion.div>
      </div>
    </>
  );
}

function TableOfContents({ book, progress }: { book: Book; progress: ShelfProgress }) {
  if (book.status === "coming-soon" || book.chapters.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <p className="font-book text-3xl font-bold text-amber-950">Coming soon!</p>
        <p className="max-w-xs text-amber-800">
          This book is still being written. Check back later for {book.title.toLowerCase()} practice.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="border-b border-amber-300 pb-2 text-center font-book text-2xl font-bold text-amber-950">
        Contents
      </h3>
      <ol className="flex flex-col gap-3">
        {book.chapters.map((chapter, i) => {
          const stats = progress[progressKeyOf(book.slug, chapter.slug)];
          return (
            <li key={chapter.slug} className="rounded-lg border border-amber-200 bg-white/60 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-book text-lg font-bold text-amber-950">
                  {i + 1}. {chapter.title}
                </p>
                <ProgressBadge stats={stats} />
              </div>
              <p className="mb-2 text-sm text-amber-800">{chapter.summary}</p>
              <Link
                href={`/practice/${book.slug}/${chapter.slug}`}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                Start practice
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function ProgressBadge({ stats }: { stats: ShelfProgress[string] | undefined }) {
  if (!stats || stats.exercisesCompleted === 0) {
    return <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-xs text-stone-700">Not started</span>;
  }
  if (stats.mastered) {
    return (
      <span className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-amber-950">★ Mastered</span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">
      {stats.exercisesCompleted} done · {formatPercent(stats.recentAccuracy)}
    </span>
  );
}
