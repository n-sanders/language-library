"use client";

export function GenerationFallback({
  topic,
  onPickTopic,
  onRetry,
}: {
  topic: string;
  onPickTopic: () => void;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-6 text-center">
      <span className="text-5xl" aria-hidden>
        🦉
      </span>
      <p className="font-book text-xl text-amber-950">
        Sorry, I couldn&apos;t write a sentence about <em>{topic}</em>. Let&apos;s try a different topic!
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className="btn-primary text-lg" onClick={onPickTopic}>
          Pick a different topic
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
