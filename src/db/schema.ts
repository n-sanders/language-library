import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { AnswerKey, StudentAnswer, Token } from "@/lib/types";

const createdAt = () =>
  integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "student"] }).notNull(),
  passwordHash: text("password_hash").notNull(),
  gradeLevel: integer("grade_level").notNull().default(3),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  isEncrypted: integer("is_encrypted", { mode: "boolean" }).notNull().default(false),
});

export const practiceSessions = sqliteTable(
  "practice_sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    book: text("book").notNull(),
    chapter: text("chapter").notNull(),
    startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp" }).notNull(),
    activeSeconds: integer("active_seconds").notNull().default(0),
  },
  (t) => [index("practice_sessions_user_idx").on(t.userId, t.book, t.chapter)],
);

export const exercises = sqliteTable(
  "exercises",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    book: text("book").notNull(),
    chapter: text("chapter").notNull(),
    topic: text("topic").notNull(),
    sentence: text("sentence").notNull(),
    tokensJson: text("tokens_json", { mode: "json" }).$type<Token[]>().notNull(),
    answerKeyJson: text("answer_key_json", { mode: "json" }).$type<AnswerKey>().notNull(),
    model: text("model").notNull(),
    revealedAt: integer("revealed_at", { mode: "timestamp" }),
    createdAt: createdAt(),
  },
  (t) => [index("exercises_user_idx").on(t.userId, t.book, t.chapter)],
);

export const attempts = sqliteTable(
  "attempts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    answerJson: text("answer_json", { mode: "json" }).$type<StudentAnswer>().notNull(),
    score: integer("score").notNull(),
    total: integer("total").notNull(),
    hintsUsed: integer("hints_used").notNull().default(0),
    durationS: integer("duration_s").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("attempts_exercise_idx").on(t.exerciseId), index("attempts_user_idx").on(t.userId)],
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    exerciseId: integer("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    content: text("content").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("chat_messages_exercise_idx").on(t.exerciseId), index("chat_messages_user_idx").on(t.userId)],
);

export const problemReports = sqliteTable("problem_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  exerciseId: integer("exercise_id")
    .notNull()
    .references(() => exercises.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  note: text("note").notNull().default(""),
  status: text("status", { enum: ["open", "resolved", "dismissed"] }).notNull().default("open"),
  createdAt: createdAt(),
});

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
