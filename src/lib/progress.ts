import { asc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const MASTERY_WINDOW = 10;
export const MASTERY_THRESHOLD = 0.8;

export type ChapterStats = {
  book: string;
  chapter: string;
  exercisesCompleted: number;
  /** Average first-try score (0-1) over the most recent exercises, or null if none yet. */
  recentAccuracy: number | null;
  mastered: boolean;
  activeSeconds: number;
  lastPracticedAt: Date | null;
};

export type ProgressMap = Record<string, ChapterStats>;

export const progressKey = (book: string, chapter: string) => `${book}/${chapter}`;

function emptyStats(book: string, chapter: string): ChapterStats {
  return {
    book,
    chapter,
    exercisesCompleted: 0,
    recentAccuracy: null,
    mastered: false,
    activeSeconds: 0,
    lastPracticedAt: null,
  };
}

/** Per-chapter progress for one student, computed from attempts and practice sessions. */
export function getProgress(userId: number): ProgressMap {
  const db = getDb();
  const map: ProgressMap = {};
  const get = (book: string, chapter: string) => (map[progressKey(book, chapter)] ??= emptyStats(book, chapter));

  const rows = db
    .select({
      exerciseId: schema.attempts.exerciseId,
      score: schema.attempts.score,
      total: schema.attempts.total,
      createdAt: schema.attempts.createdAt,
      book: schema.exercises.book,
      chapter: schema.exercises.chapter,
    })
    .from(schema.attempts)
    .innerJoin(schema.exercises, eq(schema.attempts.exerciseId, schema.exercises.id))
    .where(eq(schema.attempts.userId, userId))
    .orderBy(asc(schema.attempts.createdAt), asc(schema.attempts.id))
    .all();

  const firstTries = new Map<number, (typeof rows)[number]>();
  for (const row of rows) {
    if (!firstTries.has(row.exerciseId)) firstTries.set(row.exerciseId, row);
  }

  const byChapter = new Map<string, number[]>();
  for (const row of firstTries.values()) {
    const stats = get(row.book, row.chapter);
    stats.exercisesCompleted += 1;
    if (!stats.lastPracticedAt || row.createdAt > stats.lastPracticedAt) stats.lastPracticedAt = row.createdAt;
    const key = progressKey(row.book, row.chapter);
    const list = byChapter.get(key) ?? [];
    list.push(row.total > 0 ? row.score / row.total : 0);
    byChapter.set(key, list);
  }

  for (const [key, scores] of byChapter) {
    const recent = scores.slice(-MASTERY_WINDOW);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    map[key].recentAccuracy = avg;
    map[key].mastered = recent.length >= MASTERY_WINDOW && avg >= MASTERY_THRESHOLD;
  }

  const time = db
    .select({
      book: schema.practiceSessions.book,
      chapter: schema.practiceSessions.chapter,
      seconds: sql<number>`sum(${schema.practiceSessions.activeSeconds})`,
      lastSeen: sql<number>`max(${schema.practiceSessions.lastSeenAt})`,
    })
    .from(schema.practiceSessions)
    .where(eq(schema.practiceSessions.userId, userId))
    .groupBy(schema.practiceSessions.book, schema.practiceSessions.chapter)
    .all();

  for (const row of time) {
    const stats = get(row.book, row.chapter);
    stats.activeSeconds = Number(row.seconds) || 0;
    const lastSeen = new Date(Number(row.lastSeen) * 1000);
    if (row.seconds > 0 && (!stats.lastPracticedAt || lastSeen > stats.lastPracticedAt)) {
      stats.lastPracticedAt = lastSeen;
    }
  }

  return map;
}
