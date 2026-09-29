"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Chapter } from "@/content/books";
import type { AnswerKey, GradeResult, Token } from "@/lib/types";
import { postJson } from "./api";
import { HelperChat } from "./HelperChat";
import { LabelPalette } from "./LabelPalette";
import { ResultView } from "./ResultView";
import { TaggableSentence, type TokenFeedback } from "./TaggableSentence";
import { TopicPicker } from "./TopicPicker";
import { useActivityTracker } from "./useActivityTracker";

type Exercise = { id: number; topic: string; tokens: Token[] };

const emptyTags = (chapter: Chapter) => Object.fromEntries(chapter.labels.map((l) => [l.id, [] as number[]]));

export function PracticeApp({
  bookSlug,
  bookTitle,
  chapter,
  studentName,
}: {
  bookSlug: string;
  bookTitle: string;
  chapter: Chapter;
  studentName: string;
}) {
  useActivityTracker(bookSlug, chapter.slug);

  const [topic, setTopic] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState(chapter.labels[0].id);
  const [tags, setTags] = useState<Record<string, number[]>>(() => emptyTags(chapter));
  const [result, setResult] = useState<GradeResult | null>(null);
  const [revealedKey, setRevealedKey] = useState<AnswerKey | null>(null);
  const [checking, setChecking] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const startedAt = useRef(Date.now());

  const done = Boolean(revealedKey) || Boolean(result?.perfect);

  const loadSentence = useCallback(
    async (nextTopic: string) => {
      setTopic(nextTopic);
      setLoading(true);
      setError(null);
      setExercise(null);
      setResult(null);
      setRevealedKey(null);
      setTags(emptyTags(chapter));
      setActiveId(chapter.labels[0].id);
      try {
        const ex = await postJson<Exercise>("/api/exercises", {
          book: bookSlug,
          chapter: chapter.slug,
          topic: nextTopic,
        });
        setExercise(ex);
        startedAt.current = Date.now();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [bookSlug, chapter],
  );

  const toggle = (index: number) => {
    if (done) return;
    setResult(null);
    setTags((prev) => {
      const current = prev[activeId] ?? [];
      const next = current.includes(index) ? current.filter((i) => i !== index) : [...current, index].sort((a, b) => a - b);
      return { ...prev, [activeId]: next };
    });
  };

  const check = async () => {
    if (!exercise) return;
    setChecking(true);
    setError(null);
    try {
      const res = await postJson<{ result: GradeResult }>(`/api/exercises/${exercise.id}/submit`, {
        answer: tags,
        durationS: (Date.now() - startedAt.current) / 1000,
      });
      setResult(res.result);
      if (res.result.perfect) setSolvedCount((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your answer.");
    } finally {
      setChecking(false);
    }
  };

  const reveal = async () => {
    if (!exercise) return;
    try {
      const res = await postJson<{ key: AnswerKey }>(`/api/exercises/${exercise.id}/reveal`, {});
      setRevealedKey(res.key);
      setResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't show the answer.");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea")) return;
      const n = Number(e.key);
      if (n >= 1 && n <= chapter.labels.length) setActiveId(chapter.labels[n - 1].id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter.labels]);

  const feedback = useMemo(() => {
    if (!result || result.perfect) return undefined;
    const map = new Map<number, TokenFeedback>();
    for (const lr of result.labels) {
      for (const i of lr.correct) if (!map.has(i)) map.set(i, "correct");
      for (const i of lr.extra) map.set(i, "extra");
    }
    return map;
  }, [result]);

  const counts = Object.fromEntries(Object.entries(tags).map(([k, v]) => [k, v.length]));
  const shownTags = revealedKey ?? tags;

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[1fr_380px]">
      <section className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm tracking-widest text-amber-700 uppercase">{bookTitle}</p>
            <h1 className="font-book text-3xl font-bold">{chapter.title}</h1>
          </div>
          {solvedCount > 0 && (
            <p className="rounded-full bg-amber-200 px-3 py-1 text-sm font-semibold">
              ⭐ {solvedCount} solved this session
            </p>
          )}
        </div>

        {!topic && <TopicPicker onPick={loadSentence} />}

        {topic && (
          <div className="flex flex-col gap-5 rounded-2xl border border-amber-200 bg-white/70 p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-800">
              <span>
                Topic: <strong>{topic}</strong>
              </span>
              <button type="button" className="underline underline-offset-4" onClick={() => setTopic(null)}>
                Change topic
              </button>
            </div>

            {loading && (
              <p className="animate-pulse py-10 text-center font-book text-2xl text-amber-800">
                ✏️ Writing a sentence about {topic}...
              </p>
            )}

            {error && (
              <div className="rounded-lg bg-red-100 p-3 text-red-800">
                {error}
                {!exercise && !loading && (
                  <button type="button" className="ml-3 font-semibold underline" onClick={() => loadSentence(topic)}>
                    Try again
                  </button>
                )}
              </div>
            )}

            {exercise && (
              <>
                <TaggableSentence
                  tokens={exercise.tokens}
                  labels={chapter.labels}
                  tags={shownTags}
                  activeId={activeId}
                  onToggle={toggle}
                  feedback={feedback}
                  readOnly={done}
                />

                <LabelPalette
                  labels={chapter.labels}
                  activeId={activeId}
                  counts={counts}
                  onSelect={setActiveId}
                  disabled={done}
                />

                {result && <ResultView result={result} labels={chapter.labels} tokens={exercise.tokens} />}
                {revealedKey && (
                  <div className="rounded-xl border-2 border-sky-300 bg-sky-50 p-4 text-sky-900">
                    Here&apos;s the answer. Look at each colored line to see which words belong to each part.
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  {!done ? (
                    <>
                      <button type="button" className="btn-primary text-lg" onClick={check} disabled={checking}>
                        {checking ? "Checking..." : "Check my answer"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={reveal}>
                        Show answer
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary text-lg" onClick={() => loadSentence(topic)}>
                      Next sentence →
                    </button>
                  )}
                  <button type="button" className="btn-secondary" onClick={() => loadSentence(topic)} hidden={done}>
                    Skip this one
                  </button>
                  <ReportProblem exerciseId={exercise.id} />
                </div>
              </>
            )}
          </div>
        )}

        <Link href="/" className="self-start text-sm text-amber-800 underline underline-offset-4">
          ← Back to the bookshelf
        </Link>
      </section>

      <aside className="lg:sticky lg:top-4 lg:self-start">
        <HelperChat
          key={exercise?.id ?? "none"}
          exerciseId={exercise?.id ?? null}
          labels={chapter.labels}
          activeId={activeId}
          studentName={studentName}
        />
      </aside>
    </main>
  );
}

function ReportProblem({ exerciseId }: { exerciseId: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    setOpen(false);
    setNote("");
    setState("idle");
  }, [exerciseId]);

  if (state === "sent") return <span className="text-sm text-emerald-700">Thanks! A grown-up will take a look.</span>;

  if (!open) {
    return (
      <button type="button" className="ml-auto text-sm text-stone-500 underline underline-offset-4" onClick={() => setOpen(true)}>
        Report a problem
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2 rounded-lg border border-stone-300 bg-stone-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try {
          await postJson(`/api/exercises/${exerciseId}/report`, { note });
          setState("sent");
        } catch {
          setState("error");
        }
      }}
    >
      <label className="text-sm font-semibold" htmlFor="report-note">
        What looks wrong with this sentence or its answer?
      </label>
      <textarea
        id="report-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        className="input"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={state === "sending"}>
          Send report
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        {state === "error" && <span className="text-sm text-red-700">Couldn&apos;t send. Try again.</span>}
      </div>
    </form>
  );
}
