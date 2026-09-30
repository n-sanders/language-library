import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { AuditReviewForm } from "@/components/admin/AuditReviewForm";
import { Field } from "@/components/admin/ActionForm";
import { chapterTitle } from "@/content/books";
import { getDb, schema } from "@/db";
import { DEFAULT_AUDIT_INSTRUCTION } from "@/lib/ai/prompts";
import { AUDIT_LIST_LIMIT, AUDIT_WINDOWS, loadAuditEvents, parseAuditKind, parseAuditStudentId } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { getModels } from "@/lib/settings";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; kind?: string; q?: string }>;
}) {
  const params = await searchParams;
  const kind = parseAuditKind(params.kind);
  const q = (params.q ?? "").trim().slice(0, 100);
  const requestedStudent = parseAuditStudentId(params.student);

  const students = getDb()
    .select({ id: schema.users.id, displayName: schema.users.displayName, active: schema.users.active })
    .from(schema.users)
    .where(eq(schema.users.role, "student"))
    .orderBy(asc(schema.users.displayName))
    .all();
  const studentId = students.some((student) => student.id === requestedStudent) ? requestedStudent : null;

  const events = loadAuditEvents({ studentId, kind, q, limit: AUDIT_LIST_LIMIT });
  const model = getModels().audit;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">AI audit</h1>
        <p className="mt-1 text-sm text-stone-600">
          Everything students typed that was sent to the AI: helper questions and custom sentence topics.
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-bold">Ask the model to flag concerns</h2>
        <p className="mb-4 text-sm text-stone-600">
          Sends a slice of the history below to <code>{model}</code>.{" "}
          <Link href="/admin/settings" className="font-semibold text-amber-900 hover:underline">
            Change model
          </Link>
        </p>
        <AuditReviewForm
          key={`${studentId ?? "all"}-${kind}`}
          studentId={studentId ? String(studentId) : ""}
          kind={kind}
          model={model}
          defaultPrompt={DEFAULT_AUDIT_INSTRUCTION}
          windows={AUDIT_WINDOWS}
        />
      </section>

      <section className="flex flex-col gap-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Student">
            <select name="student" defaultValue={studentId ? String(studentId) : ""} className="input">
              <option value="">All students</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.displayName}
                  {student.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Kind">
            <select name="kind" defaultValue={kind} className="input">
              <option value="all">All</option>
              <option value="question">Helper questions</option>
              <option value="topic">Custom topics</option>
            </select>
          </Field>
          <Field label="Search">
            <input name="q" defaultValue={q} placeholder="Student words or topic" className="input" />
          </Field>
          <button type="submit" className="btn-secondary">
            Apply
          </button>
        </form>

        <p className="text-sm text-stone-600">
          {events.length === AUDIT_LIST_LIMIT
            ? `Showing the latest ${AUDIT_LIST_LIMIT} matching events. Older events are not listed.`
            : `${events.length} ${events.length === 1 ? "event" : "events"}.`}
        </p>

        {events.length === 0 ? (
          <p className="text-stone-600">Nothing to review for these filters.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map((event, index) => (
              <li key={`${event.kind}-${event.userId}-${event.createdAt.getTime()}-${index}`} className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-stone-500">
                  <span>
                    <Link href={`/admin/students/${event.userId}`} className="font-semibold text-amber-900 hover:underline">
                      {event.displayName}
                    </Link>{" "}
                    · {event.kind === "question" ? "Helper question" : "Custom topic"} · {chapterTitle(event.book, event.chapter)} ·{" "}
                    {formatDateTime(event.createdAt)}
                  </span>
                </div>
                {event.kind === "question" ? (
                  <>
                    <p className="mt-2 whitespace-pre-wrap">
                      <strong>{event.displayName}:</strong> {event.studentText}
                    </p>
                    {event.helperReply && (
                      <p className="mt-1 whitespace-pre-wrap text-stone-700">
                        <strong>Helper:</strong> {event.helperReply}
                      </p>
                    )}
                    <p className="mt-2 text-sm text-stone-500">
                      Topic &quot;{event.topic}&quot; · {event.sentence}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2">
                      <strong>Topic they typed:</strong> {event.studentText}
                    </p>
                    <p className="mt-1 font-book text-lg">{event.sentence}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
