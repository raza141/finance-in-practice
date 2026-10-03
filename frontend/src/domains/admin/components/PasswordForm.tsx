"use client";

import { useActionState } from "react";

import { changePassword, type FormState } from "../actions/auth";

const FIELD =
  "mt-2 w-full rounded-md border border-line bg-canvas/70 px-3 py-2.5 text-ink outline-none focus:border-quant/70 disabled:opacity-60";

export function PasswordForm({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(changePassword, {});

  return (
    <form action={action} className="grid max-w-sm gap-4">
      {hasPassword && (
        <label className="block">
          <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Current password</span>
          <input name="current" type="password" required autoComplete="current-password" disabled={pending} className={FIELD} />
        </label>
      )}
      <label className="block">
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">New password</span>
        <input name="next" type="password" required minLength={10} maxLength={200} autoComplete="new-password" disabled={pending} className={FIELD} />
        <span className="mt-1.5 block text-xs text-muted/80">At least 10 characters.</span>
      </label>
      <label className="block">
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Confirm new password</span>
        <input name="confirm" type="password" required minLength={10} maxLength={200} autoComplete="new-password" disabled={pending} className={FIELD} />
      </label>
      {state.message && (
        <p role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-quant" : "text-gold"}`}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-fit rounded-md bg-gold px-5 font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60"
      >
        {pending ? "Saving…" : hasPassword ? "Change password" : "Set password"}
      </button>
    </form>
  );
}
