"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const SCRIBBLE = "M10 40 C 30 10, 50 70, 70 40 S 110 10, 130 40 S 170 70, 190 40 S 230 10, 250 40 S 290 70, 310 40";
const CYCLE_S = 3;
const MESSAGE_MS = 2200;

const messages = (topic: string) => [
  "Sharpening the pencil...",
  `Thinking about ${topic}...`,
  "Picking the perfect words...",
  "Checking the dictionary...",
  "Sprinkling in some adjectives...",
  "Dotting the i's and crossing the t's...",
];

export function WritingLoader({ topic }: { topic: string }) {
  const lines = messages(topic);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % lines.length), MESSAGE_MS);
    return () => clearInterval(t);
  }, [lines.length]);

  return (
    <div role="status" className="flex flex-col items-center gap-4 py-8">
      <div className="paper w-full max-w-sm rounded-xl border border-amber-200 px-4 py-3 shadow-inner">
        <svg viewBox="0 0 320 80" className="w-full overflow-visible" aria-hidden>
          <line x1="0" y1="62" x2="320" y2="62" stroke="#93c5fd" strokeWidth="1.5" />
          <line x1="0" y1="18" x2="320" y2="18" stroke="#93c5fd" strokeWidth="1" strokeDasharray="4 4" />
          <motion.path
            d={SCRIBBLE}
            fill="none"
            stroke="#5a3620"
            strokeWidth="3"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 1 }}
            animate={{ pathLength: [0, 1, 1], opacity: [1, 1, 0] }}
            transition={{ duration: CYCLE_S, times: [0, 0.8, 1], repeat: Infinity, ease: "linear" }}
          />
          <motion.g
            animate={{ x: [10, 310, 10] }}
            transition={{ duration: CYCLE_S, times: [0, 0.8, 1], repeat: Infinity, ease: "linear" }}
          >
            <motion.g
              animate={{ y: [40, 22, 40, 58, 40], rotate: [0, -8, 0, 8, 0] }}
              transition={{ duration: (CYCLE_S * 0.8) / 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <text x="-3" y="4" fontSize="34">
                ✏️
              </text>
            </motion.g>
          </motion.g>
        </svg>
      </div>

      <div className="relative h-8 w-full overflow-hidden text-center font-book text-2xl text-amber-800">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -24, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {lines[index]}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="flex gap-2" aria-hidden>
        {["📘", "📗", "📙"].map((book, i) => (
          <motion.span
            key={book}
            className="text-2xl"
            animate={{ y: [0, -12, 0] }}
            transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity, repeatDelay: 0.3, ease: "easeOut" }}
          >
            {book}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
