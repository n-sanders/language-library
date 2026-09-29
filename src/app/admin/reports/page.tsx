import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { getDb, schema } from "@/db";
import { chapterTitle, getChapter } from "@/content/books";
import { formatDateTime } from "@/lib/format";
import { describeKey } from "@/lib/keyDisplay";
import { setReportStatus } from "../actions";

export default async function ReportsPage() {
  const reports = getDb()
    .select({
      report: schema.problemReports,
      exercise: schema.exercises,
      student: { id: schema.users.id, displayName: schema.users.displayName },
    })
    .from(schema.problemReports)
    .innerJoin(schema.exercises, eq(schema.problemReports.exerciseId, schema.exercises.id))
    .innerJoin(schema.users, eq(schema.problemReports.userId, schema.users.id))
    .orderBy(sql`case ${schema.problemReports.status} when 'open' then 0 else 1 end`, desc(schema.problemReports.id))
    .limit(100)
    .all();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Problem reports</h1>
      <p className="text-sm text-stone-600">
        Students can flag a sentence when the answer looks wrong. Check the answer key below; if the AI made a
        mistake, consider trying a different sentence-writer model in AI settings.
      </p>
      {reports.length === 0 && <p className="text-stone-600">No reports. 🎉</p>}
      <ul className="flex flex-col gap-3">
        {reports.map(({ report, exercise, student }) => {
          const chapter = getChapter(exercise.book, exercise.chapter)?.chapter;
          return (
            <li
              key={report.id}
              className={`rounded-xl border bg-white p-4 ${report.status === "open" ? "border-red-300" : "border-stone-200 opacity-70"}`}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-500">
                <span>
                  <Link href={`/admin/students/${student.id}`} className="font-semibold text-amber-900 hover:underline">
                    {student.displayName}
                  </Link>{" "}
                  · {chapterTitle(exercise.book, exercise.chapter)} · {formatDateTime(report.createdAt)} · model{" "}
                  {exercise.model}
                </span>
                <span className="font-semibold uppercase">{report.status}</span>
              </div>
              <p className="mt-1 font-book text-lg">{exercise.sentence}</p>
              {report.note && <p className="mt-1 text-sm italic">&quot;{report.note}&quot;</p>}
              {chapter && (
                <ul className="mt-2 text-sm">
                  {describeKey(chapter.labels, exercise.tokensJson, exercise.answerKeyJson).map(({ label, parts }) => (
                    <li key={label.id}>
                      <span className="font-semibold" style={{ color: label.color }}>
                        {label.name}:
                      </span>{" "}
                      {parts.join(" / ") || "-"}
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex gap-2">
                {report.status === "open" ? (
                  <>
                    <form action={setReportStatus.bind(null, report.id, "resolved")}>
                      <button className="btn-secondary px-3 py-1 text-sm">Mark resolved</button>
                    </form>
                    <form action={setReportStatus.bind(null, report.id, "dismissed")}>
                      <button className="btn-secondary px-3 py-1 text-sm">Dismiss</button>
                    </form>
                  </>
                ) : (
                  <form action={setReportStatus.bind(null, report.id, "open")}>
                    <button className="btn-secondary px-3 py-1 text-sm">Reopen</button>
                  </form>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
