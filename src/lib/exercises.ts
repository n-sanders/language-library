import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getChapter } from "@/content/books";
import { HttpError } from "./auth";

/** Loads an exercise owned by the user, along with its chapter definition. */
export function loadOwnExercise(exerciseId: number, userId: number) {
  if (!Number.isInteger(exerciseId)) throw new HttpError(400, "Invalid exercise.");
  const exercise = getDb()
    .select()
    .from(schema.exercises)
    .where(and(eq(schema.exercises.id, exerciseId), eq(schema.exercises.userId, userId)))
    .get();
  if (!exercise) throw new HttpError(404, "That sentence wasn't found.");
  const found = getChapter(exercise.book, exercise.chapter);
  if (!found) throw new HttpError(404, "That chapter no longer exists.");
  return { exercise, chapter: found.chapter };
}
