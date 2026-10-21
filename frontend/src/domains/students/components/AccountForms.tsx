"use client";

import { useActionState } from "react";

import { acceptAgreement, requestHours, type AccountActionState } from "../actions/account";
import { BOOK_BUTTON, BUTTON } from "./buttons";

const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";

function Message({ state, ok }: { state: AccountActionState; ok: string }) {
  if (state.error) return <p role="alert" className="text-sm text-gold">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-quant">{ok}</p>;
  return null;
}

/** "Request more hours" on a monthly allowance; the instructor approves it as included or as extra to pay. */
export function RequestHoursForm({ month, readOnly }: { month: string; readOnly: boolean }) {
  const [state, action, pending] = useActionState(requestHours, {});
  if (state.ok) return <Message state={state} ok="Sent. Your instructor will answer here, and you can book once it's approved." />;
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="month" value={month} />
      <fieldset disabled={pending || readOnly} className="flex flex-wrap items-end gap-2">
        <label className="w-24 text-xs text-muted">
          Extra hours
          <input name="hours" inputMode="decimal" required placeholder="4" className={`${FIELD} mt-1`} />
        </label>
        <label className="min-w-40 flex-1 text-xs text-muted">
          What for (optional)
          <input name="note" maxLength={300} placeholder="e.g. Mock exam week" className={`${FIELD} mt-1`} />
        </label>
        <button type="submit" className={BUTTON}>
          {pending ? "Sending…" : "Request more hours"}
        </button>
      </fieldset>
      <Message state={state} ok="" />
    </form>
  );
}

/** Accepting an agreement in the portal: a tick for the terms, no signature. */
export function AcceptAgreementForm({ agreementId, readOnly }: { agreementId: string; readOnly: boolean }) {
  const [state, action, pending] = useActionState(acceptAgreement, {});
  if (state.ok) return <Message state={state} ok="Accepted. Thank you: your instructor has been told." />;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="agreementId" value={agreementId} />
      <label className="flex items-start gap-2.5 text-sm text-ink/90">
        <input name="acceptTerms" type="checkbox" value="yes" required disabled={readOnly} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-quant)]" />
        <span>
          I agree to this arrangement and the{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="text-quant underline-offset-2 hover:underline">
            terms and conditions
          </a>
          .
        </span>
      </label>
      <button type="submit" disabled={pending || readOnly} className={`${BOOK_BUTTON} justify-self-start disabled:opacity-50`}>
        {pending ? "Accepting…" : "Accept agreement"}
      </button>
      <Message state={state} ok="" />
    </form>
  );
}
