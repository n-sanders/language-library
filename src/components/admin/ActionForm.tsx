"use client";

import { useActionState } from "react";

export type ActionResult = { ok?: boolean; error?: string; message?: string };
export type FormAction = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Saving...",
  className = "flex flex-col gap-3",
  buttonClassName = "btn-primary self-start",
  children,
}: {
  action: FormAction;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ActionResult, FormData>(action, {});

  return (
    <form action={formAction} className={className}>
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClassName} disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {state.error && <span className="text-sm text-red-700">{state.error}</span>}
        {state.ok && state.message && <span className="text-sm text-emerald-700">{state.message}</span>}
      </div>
    </form>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-semibold">{label}</span>
      {children}
      {hint && <span className="text-xs text-stone-500">{hint}</span>}
    </label>
  );
}
