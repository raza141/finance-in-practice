"use client";

import { startTransition, useActionState } from "react";

import { Field, FIELD } from "@/domains/admin/components/FormField";
import { PRIMARY_ACTION } from "@/domains/admin/components/PageHeader";

import { sendCheckIn } from "../actions/checkIn";
import { CheckInEmail, type CheckInDraft } from "../services/CheckInEmail";

/** The draft, for the tutor to edit and send. Locked once sent. */
export function CheckInForm({ clientId, draft, canSend }: { clientId: string; draft: CheckInDraft; canSend: boolean }) {
  const [result, send, busy] = useActionState(sendCheckIn.bind(null, clientId), null);
  const sent = result?.ok === true;
  return (
    <form
      action={send}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => send(data));
      }}
    >
      <fieldset disabled={busy || sent} className="grid min-w-0 gap-5">
        <Field label="Subject">
          <input name="subject" required maxLength={CheckInEmail.LIMITS.subject} defaultValue={draft.subject} className={FIELD} />
        </Field>
        <Field label="Message">
          <textarea name="body" required rows={16} maxLength={CheckInEmail.LIMITS.body} defaultValue={draft.body} className={FIELD} />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!canSend} className={`${PRIMARY_ACTION} disabled:opacity-50`}>
            {busy ? "Sending…" : sent ? "Sent" : "Send"}
          </button>
          <p role="status" className={`text-sm ${result?.ok ? "text-emerald-300" : "text-red-300"}`}>
            {result?.message ?? (canSend ? "" : "Email isn't set up here.")}
          </p>
        </div>
      </fieldset>
    </form>
  );
}
