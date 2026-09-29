"use client";

import { useEffect } from "react";

const TICK_MS = 5_000;
const FLUSH_EVERY_MS = 30_000;
/** Time without any input after which the student is considered away. */
const IDLE_AFTER_MS = 90_000;

/** Counts time the page is visible and the student has interacted recently, and reports it to the server. */
export function useActivityTracker(book: string, chapter: string) {
  useEffect(() => {
    let sessionId: number | undefined;
    let pendingSeconds = 0;
    let lastInput = Date.now();
    let lastTick = Date.now();
    let sending = false;

    const markInput = () => {
      lastInput = Date.now();
    };

    const tick = () => {
      const now = Date.now();
      const elapsed = (now - lastTick) / 1000;
      lastTick = now;
      if (document.visibilityState === "visible" && now - lastInput < IDLE_AFTER_MS) {
        pendingSeconds += Math.min(elapsed, TICK_MS / 1000 + 1);
      }
    };

    const payload = () => JSON.stringify({ sessionId, book, chapter, seconds: Math.round(pendingSeconds) });

    const flush = async () => {
      tick();
      if (sending || pendingSeconds < 1) return;
      sending = true;
      const body = payload();
      pendingSeconds = 0;
      try {
        const res = await fetch("/api/activity/heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
        if (res.ok) sessionId = (await res.json()).sessionId;
      } catch {
        // Offline for a moment; the next beat will start a fresh session if needed.
      } finally {
        sending = false;
      }
    };

    const beacon = () => {
      tick();
      if (pendingSeconds < 1) return;
      navigator.sendBeacon("/api/activity/heartbeat", new Blob([payload()], { type: "application/json" }));
      pendingSeconds = 0;
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") beacon();
      else {
        lastTick = Date.now();
        markInput();
      }
    };

    const events = ["pointerdown", "pointermove", "keydown", "scroll", "touchstart", "wheel"] as const;
    events.forEach((e) => window.addEventListener(e, markInput, { passive: true }));
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", beacon);
    const tickTimer = window.setInterval(tick, TICK_MS);
    const flushTimer = window.setInterval(flush, FLUSH_EVERY_MS);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markInput));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", beacon);
      window.clearInterval(tickTimer);
      window.clearInterval(flushTimer);
      beacon();
    };
  }, [book, chapter]);
}
