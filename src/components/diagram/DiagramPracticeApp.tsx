"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DiagramChapter } from "@/content/books";
import { GENERATE_TIMEOUT_MS, isGenerationFailure, postJson } from "@/components/sentence/api";
import { GenerationFallback } from "@/components/sentence/GenerationFallback";
import { HelperChat } from "@/components/sentence/HelperChat";
import { ReportProblem } from "@/components/sentence/ReportProblem";
import { TopicPicker } from "@/components/sentence/TopicPicker";
import { useActivityTracker } from "@/components/sentence/useActivityTracker";
import { WritingLoader } from "@/components/sentence/WritingLoader";
import { applyElement, availableElements, placedWords, placeWord, unplaceWord, type ElementId } from "@/lib/diagram/draft";
import { skeletonFor } from "@/lib/diagram/skeleton";
import { ROLE_NAMES, type DiagramGradeResult, type DiagramMode, type DiagramNode, type DraftNode, type WordStatus } from "@/lib/diagram/types";
import { detokenize } from "@/lib/tokenize";
import type { Token } from "@/lib/types";
import { DiagramCanvas } from "./DiagramCanvas";
import { DiagramResult } from "./DiagramResult";
import { ElementPalette } from "./ElementPalette";
import { ExampleCard } from "./ExampleCard";
import { ModePicker, useDiagramMode } from "./ModePicker";
import { WordBank } from "./WordBank";

type Exercise = { id: number; topic: string; tokens: Token[]; structure: DiagramNode[] };

const SAMPLE_TOPIC = "Sample";

export function DiagramPracticeApp({
  bookSlug,
  bookTitle,
  chapter,
  studentName,
  stockMode = false,
}: {
  bookSlug: string;
  bookTitle: string;
  chapter: DiagramChapter;
  studentName: string;
  /** Serve this chapter's hand-built examples instead of asking for a topic. */
  stockMode?: boolean;
}) {
  useActivityTracker(bookSlug, chapter.slug);
  const [mode, setMode] = useDiagramMode(bookSlug, chapter.slug);

  const [topic, setTopic] = useState<string | null>(null);
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationFailed, setGenerationFailed] = useState(false);
  const [draft, setDraft] = useState<DraftNode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heldWord, setHeldWord] = useState<number | null>(null);
  const [result, setResult] = useState<DiagramGradeResult | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [revealed, setRevealed] = useState<DiagramNode[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const startedAt = useRef(Date.now());

  const done = Boolean(revealed) || Boolean(result?.perfect);

  const resetWork = useCallback((structure: DiagramNode[] | null, nextMode: DiagramMode) => {
    setDraft(structure ? skeletonFor(nextMode, structure) : []);
    setSelectedId(null);
    setHeldWord(null);
    setResult(null);
  }, []);

  const loadSentence = useCallback(
    async (nextTopic: string) => {
      setTopic(nextTopic);
      setLoading(true);
      setError(null);
      setGenerationFailed(false);
      setExercise(null);
      setRevealed(null);
      setAttempted(false);
      resetWork(null, mode);
      try {
        const ex = await postJson<Exercise>(
          "/api/exercises",
          { book: bookSlug, chapter: chapter.slug, topic: nextTopic },
          { timeoutMs: GENERATE_TIMEOUT_MS },
        );
        setExercise(ex);
        resetWork(ex.structure, mode);
        startedAt.current = Date.now();
      } catch (err) {
        if (isGenerationFailure(err)) setGenerationFailed(true);
        else setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [bookSlug, chapter.slug, mode, resetWork],
  );

  const changeMode = (next: DiagramMode) => {
    setMode(next);
    if (exercise && !done && !attempted) resetWork(exercise.structure, next);
  };

  const edit = (next: DraftNode[]) => {
    setDraft(next);
    setResult(null);
  };

  const onSlotClick = (nodeId: string) => {
    if (done) return;
    if (heldWord !== null) {
      edit(placeWord(draft, nodeId, heldWord));
      setHeldWord(null);
      return;
    }
    setSelectedId((cur) => (cur === nodeId ? null : nodeId));
  };

  const onAdd = (element: ElementId) => {
    const next = applyElement(draft, selectedId, element);
    edit(next.nodes);
    setSelectedId(next.select);
  };

  const check = async () => {
    if (!exercise) return;
    setChecking(true);
    setError(null);
    try {
      const res = await postJson<{ result: DiagramGradeResult }>(`/api/exercises/${exercise.id}/submit`, {
        diagram: { nodes: draft },
        mode,
        durationS: (Date.now() - startedAt.current) / 1000,
      });
      setResult(res.result);
      setAttempted(true);
      setSelectedId(null);
      setHeldWord(null);
      if (res.result.perfect) setSolvedCount((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your diagram.");
    } finally {
      setChecking(false);
    }
  };

  const reveal = async () => {
    if (!exercise) return;
    try {
      const res = await postJson<{ diagram?: DiagramNode[] }>(`/api/exercises/${exercise.id}/reveal`, { mode });
      setRevealed(res.diagram ?? []);
      setResult(null);
      setSelectedId(null);
      setHeldWord(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't show the answer.");
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setHeldWord(null);
      setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wordStatus = useMemo(() => {
    if (!result || result.perfect) return undefined;
    return new Map<number, WordStatus>(result.words.map((w) => [w.index, w.status]));
  }, [result]);

  const selected = draft.find((n) => n.id === selectedId) ?? null;
  const elements = availableElements(draft, selectedId, chapter.features, mode);
  const placed = useMemo(() => placedWords(draft), [draft]);
  const focusName = selected ? ROLE_NAMES[selected.role] : "diagram";

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-4 pb-12 lg:grid-cols-[1fr_380px]">
      <section className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm tracking-widest text-amber-700 uppercase">{bookTitle}</p>
            <h1 className="font-book text-3xl font-bold">{chapter.title}</h1>
            <p className="text-amber-800">{chapter.summary}</p>
          </div>
          {solvedCount > 0 && (
            <motion.p
              key={solvedCount}
              className="rounded-full bg-amber-200 px-3 py-1 text-sm font-semibold"
              initial={{ scale: 1.6, rotate: -8 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 12 }}
            >
              ⭐ {solvedCount} solved this session
            </motion.p>
          )}
        </div>

        <ModePicker mode={mode} onChange={changeMode} disabled={attempted && !done} />
        <ExampleCard examples={chapter.examples} />

        {!topic &&
          (stockMode ? (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-amber-200 bg-white/70 p-5">
              <p className="text-amber-900">Practice a sample sentence from this chapter. No new sentence is written.</p>
              <button type="button" className="btn-primary" onClick={() => loadSentence(SAMPLE_TOPIC)}>
                Practice a sample sentence
              </button>
            </div>
          ) : (
            <TopicPicker onPick={loadSentence} />
          ))}

        {topic && (
          <div className="flex flex-col gap-5 rounded-2xl border border-amber-200 bg-white/70 p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-amber-800">
              {stockMode ? (
                <span>Sample sentence for this chapter.</span>
              ) : (
                <span>
                  Topic: <strong>{topic}</strong>
                </span>
              )}
              {!stockMode && (
                <button type="button" className="underline underline-offset-4" onClick={() => setTopic(null)}>
                  Change topic
                </button>
              )}
            </div>

            {loading && <WritingLoader topic={topic} />}

            {generationFailed && !loading && (
              <GenerationFallback topic={topic} onPickTopic={() => setTopic(null)} onRetry={() => loadSentence(topic)} />
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
                <p className="font-book text-2xl leading-relaxed text-amber-950">{detokenize(exercise.tokens)}</p>

                {revealed ? (
                  <>
                    <DiagramCanvas nodes={revealed} tokens={exercise.tokens} readOnly />
                    <div className="rounded-xl border-2 border-sky-300 bg-sky-50 p-4 text-sky-900">
                      Here&apos;s the answer. Follow each line to see where every word belongs.
                    </div>
                  </>
                ) : (
                  <>
                    <DiagramCanvas
                      nodes={draft}
                      tokens={exercise.tokens}
                      selectedId={selectedId}
                      armed={heldWord !== null}
                      wordStatus={wordStatus}
                      readOnly={done}
                      emptyMessage="Blank page! Add a baseline from the diagram parts below to get started."
                      onSlotClick={onSlotClick}
                      onWordClick={(w) => !done && edit(unplaceWord(draft, w))}
                    />
                    {!done && mode !== "guided" && (
                      <ElementPalette elements={elements} selectedName={selected ? ROLE_NAMES[selected.role] : null} onAdd={onAdd} />
                    )}
                    {!done && (
                      <WordBank
                        tokens={exercise.tokens}
                        placed={placed}
                        heldWord={heldWord}
                        onHold={setHeldWord}
                        onDrop={(w, nodeId) => {
                          edit(placeWord(draft, nodeId, w));
                          setHeldWord(null);
                        }}
                      />
                    )}
                  </>
                )}

                {result && <DiagramResult result={result} tokens={exercise.tokens} />}

                <div className="flex flex-wrap items-center gap-3">
                  {!done ? (
                    <>
                      <button type="button" className="btn-primary text-lg" onClick={check} disabled={checking}>
                        {checking ? "Checking..." : "Check my diagram"}
                      </button>
                      <button type="button" className="btn-secondary" onClick={reveal}>
                        Show answer
                      </button>
                      <button type="button" className="btn-secondary" onClick={() => loadSentence(topic)}>
                        {stockMode ? "Another sentence" : "Skip this one"}
                      </button>
                    </>
                  ) : (
                    <button type="button" className="btn-primary text-lg" onClick={() => loadSentence(topic)}>
                      {stockMode ? "Another sentence" : "Next sentence →"}
                    </button>
                  )}
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
          focusId={selected?.role}
          focusName={focusName}
          studentName={studentName}
          diagram={{ nodes: draft, mode, selectedId }}
        />
      </aside>
    </main>
  );
}
