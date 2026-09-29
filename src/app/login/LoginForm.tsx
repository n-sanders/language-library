"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-amber-900">Username</span>
        <input
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="input"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-amber-900">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="input" />
      </label>
      {state.error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-primary mt-2">
        {pending ? "Opening the library..." : "Enter the library"}
      </button>
    </form>
  );
}
