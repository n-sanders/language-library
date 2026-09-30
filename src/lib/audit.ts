import { and, asc, desc, eq, inArray, notInArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { presetTopicLabels, isCustomTopic } from "@/content/topics";
import { chapterTitle } from "@/content/books";
import { getDb, schema } from "@/db";
import { formatDateTime } from "@/lib/format";

export const AUDIT_LIST_LIMIT = 200;
export const AUDIT_WINDOWS = [25, 50, 100, 200] as const;
export const AUDIT_TRANSCRIPT_CHAR_LIMIT = 24_000;

export type AuditKind = "all" | "question" | "topic";

export type AuditEvent = {
  kind: "question" | "topic";
  createdAt: Date;
  userId: number;
  displayName: string;
  book: string;
  chapter: string;
  topic: string;
  sentence: string;
  /** Helper question, or the custom topic the student typed. */
  studentText: string;
  /** Helper reply that followed a question. Null for custom topics. */
  helperReply: string | null;
};

export function parseAuditKind(raw: string | undefined): AuditKind {
  return raw === "question" || raw === "topic" ? raw : "all";
}

export function parseAuditStudentId(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseAuditWindow(raw: string | undefined): (typeof AUDIT_WINDOWS)[number] | null {
  const n = Number(raw);
  return AUDIT_WINDOWS.find((size) => size === n) ?? null;
}

function contains(column: AnyColumn, q: string): SQL {
  const pattern = `%${q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
  return sql`${column} LIKE ${pattern} ESCAPE '\\'`;
}

export function loadAuditEvents(opts: {
  studentId: number | null;
  kind: AuditKind;
  q: string;
  limit: number;
}): AuditEvent[] {
  const db = getDb();
  const q = opts.q.trim();
  const events: AuditEvent[] = [];

  if (opts.kind !== "topic") {
    const rows = db
      .select({
        id: schema.chatMessages.id,
        content: schema.chatMessages.content,
        createdAt: schema.chatMessages.createdAt,
        exerciseId: schema.chatMessages.exerciseId,
        userId: schema.users.id,
        displayName: schema.users.displayName,
        book: schema.exercises.book,
        chapter: schema.exercises.chapter,
        topic: schema.exercises.topic,
        sentence: schema.exercises.sentence,
      })
      .from(schema.chatMessages)
      .innerJoin(schema.users, eq(schema.chatMessages.userId, schema.users.id))
      .innerJoin(schema.exercises, eq(schema.chatMessages.exerciseId, schema.exercises.id))
      .where(
        and(
          eq(schema.chatMessages.role, "user"),
          opts.studentId != null ? eq(schema.chatMessages.userId, opts.studentId) : undefined,
          q ? contains(schema.chatMessages.content, q) : undefined,
        ),
      )
      .orderBy(desc(schema.chatMessages.id))
      .limit(opts.limit)
      .all();

    const exerciseIds = [...new Set(rows.map((row) => row.exerciseId))];
    const assistants = exerciseIds.length
      ? db
          .select({
            id: schema.chatMessages.id,
            exerciseId: schema.chatMessages.exerciseId,
            content: schema.chatMessages.content,
          })
          .from(schema.chatMessages)
          .where(and(eq(schema.chatMessages.role, "assistant"), inArray(schema.chatMessages.exerciseId, exerciseIds)))
          .orderBy(asc(schema.chatMessages.id))
          .all()
      : [];
    const repliesByExercise = new Map<number, { id: number; content: string }[]>();
    for (const reply of assistants) {
      const list = repliesByExercise.get(reply.exerciseId) ?? [];
      list.push(reply);
      repliesByExercise.set(reply.exerciseId, list);
    }

    for (const row of rows) {
      const reply = repliesByExercise.get(row.exerciseId)?.find((candidate) => candidate.id > row.id);
      events.push({
        kind: "question",
        createdAt: row.createdAt,
        userId: row.userId,
        displayName: row.displayName,
        book: row.book,
        chapter: row.chapter,
        topic: row.topic,
        sentence: row.sentence,
        studentText: row.content,
        helperReply: reply?.content ?? null,
      });
    }
  }

  if (opts.kind !== "question") {
    const rows = db
      .select({
        createdAt: schema.exercises.createdAt,
        userId: schema.users.id,
        displayName: schema.users.displayName,
        book: schema.exercises.book,
        chapter: schema.exercises.chapter,
        topic: schema.exercises.topic,
        sentence: schema.exercises.sentence,
      })
      .from(schema.exercises)
      .innerJoin(schema.users, eq(schema.exercises.userId, schema.users.id))
      .where(
        and(
          notInArray(schema.exercises.topic, [...presetTopicLabels()]),
          opts.studentId != null ? eq(schema.exercises.userId, opts.studentId) : undefined,
          q ? contains(schema.exercises.topic, q) : undefined,
        ),
      )
      .orderBy(desc(schema.exercises.id))
      .limit(opts.limit)
      .all()
      .filter((row) => isCustomTopic(row.topic));

    for (const row of rows) {
      events.push({
        kind: "topic",
        createdAt: row.createdAt,
        userId: row.userId,
        displayName: row.displayName,
        book: row.book,
        chapter: row.chapter,
        topic: row.topic,
        sentence: row.sentence,
        studentText: row.topic,
        helperReply: null,
      });
    }
  }

  events.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  return events.slice(0, opts.limit);
}

function formatEvent(event: AuditEvent): string {
  const when = formatDateTime(event.createdAt);
  const where = chapterTitle(event.book, event.chapter);
  if (event.kind === "question") {
    return [
      `${when} — helper question — ${event.displayName} — ${where} — topic "${event.topic}"`,
      `Sentence: ${event.sentence}`,
      `Student: ${event.studentText}`,
      event.helperReply ? `Helper: ${event.helperReply}` : "Helper: (no reply saved)",
    ].join("\n");
  }
  return [
    `${when} — custom topic — ${event.displayName} — ${where}`,
    `Topic they typed: ${event.studentText}`,
    `Sentence generated: ${event.sentence}`,
  ].join("\n");
}

/** Newest events are kept. The transcript itself is oldest-first so the model can read it in order. */
export function formatAuditTranscript(events: AuditEvent[]): { text: string; included: number; truncated: boolean } {
  const kept: string[] = [];
  let chars = 0;
  for (const event of events) {
    const body = formatEvent(event);
    const extra = body.length + 8;
    if (chars + extra > AUDIT_TRANSCRIPT_CHAR_LIMIT && kept.length > 0) {
      const chronological = kept.reverse();
      return {
        text: chronological.map((block, i) => `[${i + 1}] ${block}`).join("\n\n"),
        included: chronological.length,
        truncated: true,
      };
    }
    kept.push(body);
    chars += extra;
  }
  const chronological = kept.reverse();
  return {
    text: chronological.map((block, i) => `[${i + 1}] ${block}`).join("\n\n"),
    included: chronological.length,
    truncated: false,
  };
}
