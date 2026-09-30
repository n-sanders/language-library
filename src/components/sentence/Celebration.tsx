"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

const COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#a855f7", "#ec4899", "#facc15"];
const PRAISE = [
  "Perfect! You found every one.",
  "Wow! Every single one!",
  "Nailed it! Grammar superstar!",
  "Amazing! A perfect score!",
  "Brilliant! You're on fire!",
  "Spot on! Every word in place!",
];
const BURST = ["⭐", "✨", "🌟", "💫", "⭐", "✨", "🌟", "💫"];
const PIECES_PER_SIDE = 60;
const CONFETTI_MS = 4000;

type Piece = {
  id: number;
  fromLeft: boolean;
  dx: number;
  peak: number;
  fall: number;
  spin: number;
  size: number;
  round: boolean;
  color: string;
  duration: number;
  delay: number;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);

function makePieces(): Piece[] {
  const w = window.innerWidth;
  const h = window.innerHeight;
  return Array.from({ length: PIECES_PER_SIDE * 2 }, (_, id) => {
    const fromLeft = id % 2 === 0;
    const peak = rand(0.45, 0.95) * h;
    return {
      id,
      fromLeft,
      dx: (fromLeft ? 1 : -1) * rand(0.1, 0.6) * w,
      peak,
      fall: peak + rand(80, 0.3 * h),
      spin: rand(-720, 720),
      size: rand(7, 13),
      round: Math.random() < 0.3,
      color: COLORS[id % COLORS.length],
      duration: rand(2.2, 3.4),
      delay: rand(0, 0.3),
    };
  });
}

function Confetti() {
  const [pieces] = useState(makePieces);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute bottom-0"
          style={{
            [p.fromLeft ? "left" : "right"]: 0,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            borderRadius: p.round ? 999 : 2,
            backgroundColor: p.color,
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: [0, p.dx * 0.7, p.dx],
            y: [0, -p.peak, -p.peak + p.fall],
            rotate: [0, p.spin * 0.4, p.spin],
            opacity: [1, 1, 0],
          }}
          transition={{
            default: { duration: p.duration, delay: p.delay, times: [0, 0.3, 1], ease: ["easeOut", "easeIn"] },
            opacity: { duration: p.duration, delay: p.delay, times: [0, 0.85, 1] },
          }}
        />
      ))}
    </div>
  );
}

export function PerfectCelebration() {
  const reduceMotion = useReducedMotion();
  const [praise] = useState(() => PRAISE[Math.floor(Math.random() * PRAISE.length)]);
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), CONFETTI_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {showConfetti && !reduceMotion && <Confetti />}
      <motion.div
        role="status"
        className="relative rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 via-lime-50 to-emerald-50 p-4 text-emerald-900 shadow-[0_0_24px_rgba(16,185,129,0.35)]"
        initial={{ scale: 0.6, opacity: 0, rotate: -3 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 420, damping: 14 }}
      >
        {!reduceMotion &&
          BURST.map((star, i) => {
            const angle = (i / BURST.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-1/2 text-2xl"
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{ x: Math.cos(angle) * 170, y: Math.sin(angle) * 70, scale: [0, 1.4, 0.8], opacity: [1, 1, 0] }}
                transition={{ duration: 1.1, delay: 0.1, ease: "easeOut" }}
              >
                {star}
              </motion.span>
            );
          })}
        <p className="flex items-center gap-3 text-2xl font-bold">
          <motion.span
            className="inline-block text-4xl"
            animate={{ rotate: [0, -18, 16, -12, 10, 0], scale: [1, 1.3, 1.1, 1.25, 1] }}
            transition={{ duration: 1, delay: 0.2, repeat: 2, repeatDelay: 0.6 }}
          >
            🎉
          </motion.span>
          {praise}
        </p>
      </motion.div>
    </>
  );
}
