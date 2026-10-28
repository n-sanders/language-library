"use client";

import { useEffect, useState } from "react";
import { postJson } from "./api";

export function ReportProblem({ exerciseId }: { exerciseId: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => {
    setOpen(false);
    setNote("");
    setState("idle");
  }, [exerciseId]);

  if (state === "sent") return <span className="text-sm text-emerald-700">Thanks! A grown-up will take a look.</span>;

  if (!open) {
    return (
      <button type="button" className="ml-auto text-sm text-stone-500 underline underline-offset-4" onClick={() => setOpen(true)}>
        Report a problem
      </button>
    );
  }

  return (
    <form
      className="flex w-full flex-col gap-2 rounded-lg border border-stone-300 bg-stone-50 p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        try {
          await postJson(`/api/exercises/${exerciseId}/report`, { note });
          setState("sent");
        } catch {
          setState("error");
        }
      }}
    >
      <label className="text-sm font-semibold" htmlFor="report-note">
        What looks wrong with this sentence or its answer?
      </label>
      <textarea
        id="report-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        maxLength={1000}
        className="input"
      />
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={state === "sending"}>
          Send report
        </button>
        <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(false)}>
          Cancel
        </button>
        {state === "error" && <span className="text-sm text-red-700">Couldn&apos;t send. Try again.</span>}
      </div>
    </form>
  );
}
