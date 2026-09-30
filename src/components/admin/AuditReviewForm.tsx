"use client";

import { useActionState } from "react";
import { runAuditReview } from "@/app/admin/actions";
import { Field } from "./ActionForm";

export function AuditReviewForm({
  studentId,
  kind,
  model,
  defaultPrompt,
  windows,
}: {
  studentId: string;
  kind: string;
  model: string;
  defaultPrompt: string;
  windows: readonly number[];
}) {
  const [state, formAction, pending] = useActionState(runAuditReview, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="student" value={studentId} />
      <input type="hidden" name="kind" value={kind} />
      <Field label="What should the model look for?">
        <textarea name="prompt" required rows={4} maxLength={2000} defaultValue={defaultPrompt} className="input" />
      </Field>
      <Field label="History" hint={`Uses the student and kind filters applied below. Model: ${model}`}>
        <select name="window" defaultValue="50" className="input max-w-xs">
          {windows.map((size) => (
            <option key={size} value={size}>
              Last {size} events
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn-primary" disabled={pending}>
          {pending ? "Reviewing..." : "Review history"}
        </button>
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
      </div>
      {state.ok && state.message && <p className="text-sm text-stone-600">{state.message}</p>}
      {state.review && <div className="whitespace-pre-wrap rounded-lg bg-stone-50 p-4 text-sm">{state.review}</div>}
    </form>
  );
}
