import { and, asc, desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb, schema } from "@/db";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { GradeSelect } from "@/components/admin/GradeSelect";
import { BOOKS, chapterTitle, getChapter } from "@/content/books";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { gradeLabel } from "@/lib/grade";
import { describeKey } from "@/lib/keyDisplay";
import { getProgress, MASTERY_WINDOW, progressKey } from "@/lib/progress";
import { changeUsername, resetPassword, updateStudent } from "../../actions";

const RECENT_LIMIT = 30;

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = Number(id);
  const db = getDb();
  const student = Number.isInteger(userId)
    ? db
        .select()
        .from(schema.users)
        .where(and(eq(schema.users.id, userId), eq(schema.users.role, "student")))
        .get()
    : undefined;
  if (!student) notFound();

  const progress = getProgress(student.id);
  const totalSeconds = Object.values(progress).reduce((n, c) => n + c.activeSeconds, 0);

  const recent = db
    .select()
    .from(schema.exercises)
    .where(eq(schema.exercises.userId, student.id))
    .orderBy(desc(schema.exercises.id))
    .limit(RECENT_LIMIT)
    .all();
  const ids = recent.map((e) => e.id);

  const attempts = ids.length
    ? db.select().from(schema.attempts).where(inArray(schema.attempts.exerciseId, ids)).orderBy(asc(schema.attempts.id)).all()
    : [];
  const chats = ids.length
    ? db
        .select()
        .from(schema.chatMessages)
        .where(inArray(schema.chatMessages.exerciseId, ids))
        .orderBy(asc(schema.chatMessages.id))
        .all()
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-amber-800 hover:underline">
          ← All students
        </Link>
        <h1 className="mt-1 text-2xl font-bold">
          {student.displayName} <span className="text-base font-normal text-stone-500">@{student.username}</span>
        </h1>
        <p className="text-stone-600">
          {gradeLabel(student.gradeLevel)} · {formatDuration(totalSeconds)} total practice
          {!student.active && " · inactive"}
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Progress by chapter</h2>
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-100 text-stone-600">
              <tr>
                <th className="px-4 py-2">Chapter</th>
                <th className="px-4 py-2">Sentences</th>
                <th className="px-4 py-2">First-try accuracy (last {MASTERY_WINDOW})</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Last practiced</th>
              </tr>
            </thead>
            <tbody>
              {BOOKS.flatMap((book) =>
                book.chapters.map((chapter) => {
                  const s = progress[progressKey(book.slug, chapter.slug)];
                  return (
                    <tr key={`${book.slug}/${chapter.slug}`} className="border-t border-stone-100">
                      <td className="px-4 py-2">
                        <span className="text-stone-500">{book.title}:</span> {chapter.title}
                      </td>
                      <td className="px-4 py-2">{s?.exercisesCompleted ?? 0}</td>
                      <td className="px-4 py-2">{formatPercent(s?.recentAccuracy ?? null)}</td>
                      <td className="px-4 py-2">
                        {s?.mastered ? "★ Mastered" : s?.exercisesCompleted ? "Practicing" : "Not started"}
                      </td>
                      <td className="px-4 py-2">{formatDuration(s?.activeSeconds ?? 0)}</td>
                      <td className="px-4 py-2">{formatDateTime(s?.lastPracticedAt ?? null)}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">Recent sentences</h2>
          <Link href={`/admin/audit?student=${student.id}`} className="text-sm font-semibold text-amber-800 hover:underline">
            AI audit for this student
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-stone-600">No sentences yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {recent.map((ex) => {
              const tries = attempts.filter((a) => a.exerciseId === ex.id);
              const first = tries[0];
              const best = tries.reduce((b, a) => (a.total && a.score / a.total > b ? a.score / a.total : b), 0);
              const messages = chats.filter((c) => c.exerciseId === ex.id);
              const chapter = getChapter(ex.book, ex.chapter)?.chapter;
              return (
                <li key={ex.id} className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-500">
                    <span>
                      {chapterTitle(ex.book, ex.chapter)} · topic &quot;{ex.topic}&quot; · {formatDateTime(ex.createdAt)}
                    </span>
                    <span>
                      {tries.length === 0
                        ? "not attempted"
                        : `first try ${formatPercent(first.total ? first.score / first.total : 0)} · best ${formatPercent(best)} · ${tries.length} ${tries.length === 1 ? "try" : "tries"}`}
                      {ex.revealedAt && " · answer shown"}
                      {messages.length > 0 && ` · ${messages.filter((m) => m.role === "user").length} helper questions`}
                    </span>
                  </div>
                  <p className="mt-1 font-book text-lg">{ex.sentence}</p>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer text-amber-800">Answer key and helper chat</summary>
                    {chapter && (
                      <ul className="mt-2 flex flex-col gap-0.5">
                        {describeKey(chapter.labels, ex.tokensJson, ex.answerKeyJson).map(({ label, parts }) => (
                          <li key={label.id}>
                            <span className="font-semibold" style={{ color: label.color }}>
                              {label.name}:
                            </span>{" "}
                            {parts.join(" / ") || "-"}
                          </li>
                        ))}
                      </ul>
                    )}
                    {messages.length > 0 ? (
                      <div className="mt-3 flex flex-col gap-1.5 rounded-lg bg-stone-50 p-3">
                        {messages.map((m) => (
                          <p key={m.id} className="whitespace-pre-wrap">
                            <strong>{m.role === "user" ? student.displayName : "Helper"}:</strong> {m.content}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-stone-500">No helper chat for this sentence.</p>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-xl border border-stone-200 bg-white p-6">
          <h2 className="mb-4 text-lg font-bold">Profile</h2>
          <ActionForm action={updateStudent.bind(null, student.id)} submitLabel="Save profile">
            <Field label="Display name">
              <input name="displayName" defaultValue={student.displayName} required className="input" />
            </Field>
            <Field label="Grade level">
              <GradeSelect defaultValue={student.gradeLevel} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={student.active} />
              Account active (unchecking signs them out and blocks sign-in)
            </label>
          </ActionForm>
        </section>

        <section className="flex flex-col gap-6 rounded-xl border border-stone-200 bg-white p-6">
          <div>
            <h2 className="mb-4 text-lg font-bold">Reset password</h2>
            <ActionForm action={resetPassword.bind(null, student.id)} submitLabel="Set new password">
              <Field label="New password" hint="The student will be signed out everywhere.">
                <input name="password" type="text" required autoComplete="off" className="input" />
              </Field>
            </ActionForm>
          </div>
          <div>
            <h2 className="mb-4 text-lg font-bold">Username</h2>
            <ActionForm action={changeUsername.bind(null, student.id)} submitLabel="Change username">
              <Field label="Username">
                <input name="username" defaultValue={student.username} required autoCapitalize="none" className="input" />
              </Field>
            </ActionForm>
          </div>
        </section>
      </div>
    </div>
  );
}
