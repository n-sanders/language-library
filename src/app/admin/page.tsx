import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { GradeSelect } from "@/components/admin/GradeSelect";
import { formatDateTime, formatDuration, formatPercent } from "@/lib/format";
import { gradeShort } from "@/lib/grade";
import { getProgress } from "@/lib/progress";
import { getApiKey } from "@/lib/settings";
import { createStudent } from "./actions";

export default async function AdminStudentsPage() {
  const students = getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.role, "student"))
    .orderBy(asc(schema.users.displayName))
    .all();

  const rows = students.map((s) => {
    const stats = Object.values(getProgress(s.id));
    const exercises = stats.reduce((n, c) => n + c.exercisesCompleted, 0);
    const seconds = stats.reduce((n, c) => n + c.activeSeconds, 0);
    const weighted = stats.filter((c) => c.recentAccuracy !== null);
    const weight = weighted.reduce((n, c) => n + c.exercisesCompleted, 0);
    const accuracy = weight
      ? weighted.reduce((n, c) => n + (c.recentAccuracy ?? 0) * c.exercisesCompleted, 0) / weight
      : null;
    const last = stats.reduce<Date | null>(
      (d, c) => (c.lastPracticedAt && (!d || c.lastPracticedAt > d) ? c.lastPracticedAt : d),
      null,
    );
    const mastered = stats.filter((c) => c.mastered).length;
    return { student: s, exercises, seconds, accuracy, last, mastered };
  });

  return (
    <div className="flex flex-col gap-8">
      {!getApiKey() && (
        <div className="rounded-lg border border-amber-300 bg-amber-100 p-4 text-amber-900">
          The OpenRouter API key isn&apos;t set yet, so practice sentences and the helper won&apos;t work.{" "}
          <Link href="/admin/settings" className="font-semibold underline">
            Set it up in AI settings
          </Link>
          .
        </div>
      )}

      <section>
        <h1 className="mb-4 text-2xl font-bold">Students</h1>
        {rows.length === 0 ? (
          <p className="text-stone-600">No students yet. Add one below.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-stone-100 text-stone-600">
                <tr>
                  <th className="px-4 py-2">Student</th>
                  <th className="px-4 py-2">Grade</th>
                  <th className="px-4 py-2">Sentences</th>
                  <th className="px-4 py-2">Recent accuracy</th>
                  <th className="px-4 py-2">Chapters mastered</th>
                  <th className="px-4 py-2">Time practicing</th>
                  <th className="px-4 py-2">Last active</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ student, exercises, seconds, accuracy, last, mastered }) => (
                  <tr key={student.id} className="border-t border-stone-100 hover:bg-amber-50/50">
                    <td className="px-4 py-2">
                      <Link href={`/admin/students/${student.id}`} className="font-semibold text-amber-900 hover:underline">
                        {student.displayName}
                      </Link>
                      <span className="ml-2 text-stone-500">@{student.username}</span>
                      {!student.active && (
                        <span className="ml-2 rounded bg-stone-200 px-1.5 py-0.5 text-xs">inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-2">{gradeShort(student.gradeLevel)}</td>
                    <td className="px-4 py-2">{exercises}</td>
                    <td className="px-4 py-2">{formatPercent(accuracy)}</td>
                    <td className="px-4 py-2">{mastered}</td>
                    <td className="px-4 py-2">{formatDuration(seconds)}</td>
                    <td className="px-4 py-2">{formatDateTime(last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="max-w-xl rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold">Add a student</h2>
        <ActionForm action={createStudent} submitLabel="Add student" pendingLabel="Adding...">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Display name" hint="Shown to the student, e.g. Emma">
              <input name="displayName" required className="input" />
            </Field>
            <Field label="Username" hint="Used to sign in, e.g. emma">
              <input name="username" required autoCapitalize="none" className="input" />
            </Field>
            <Field label="Password">
              <input name="password" type="text" required autoComplete="off" className="input" />
            </Field>
            <Field label="Grade level" hint="Sets sentence difficulty">
              <GradeSelect />
            </Field>
          </div>
        </ActionForm>
      </section>
    </div>
  );
}
