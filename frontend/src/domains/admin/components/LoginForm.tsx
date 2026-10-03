"use client";

import { useActionState } from "react";

import { login, type FormState } from "../actions/auth";

const FIELD =
  "mt-2 w-full rounded-md border border-line bg-canvas/70 px-3 py-2.5 text-ink outline-none focus:border-quant/70 disabled:opacity-60";

export function LoginForm({ initialMessage }: { initialMessage?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(login, { message: initialMessage });

  return (
    <form action={action} className="grid gap-4">
      <label className="block">
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Email</span>
        <input name="email" type="email" defaultValue={state.email} required autoFocus autoComplete="username" maxLength={254} disabled={pending} className={FIELD} />
      </label>
      <label className="block">
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Password</span>
        <input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          maxLength={200}
          disabled={pending}
          className={FIELD}
        />
      </label>
      {state.message && (
        <p role="alert" className="text-sm text-gold">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 rounded-md bg-gold px-5 font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
