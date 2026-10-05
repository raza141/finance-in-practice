"use client";

import { startTransition, useActionState, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { sendConfirmation, type ConfirmationFormState } from "../actions/invoices";
import type { BookingPrefill } from "../types";

/** Session details to email as a branded confirmation. Uncontrolled: a failed send keeps what was typed. */
export function ConfirmationForm({
  initial,
  timeZones,
  topics,
  emailEnabled,
}: {
  initial: Omit<BookingPrefill, "bookingUid"> & { bookingUid: string | null };
  /** Built on the server, so server and browser render the same list. */
  timeZones: readonly string[];
  topics: readonly string[];
  emailEnabled: boolean;
}) {
  const [state, action, sending] = useActionState<ConfirmationFormState, FormData>(sendConfirmation, {});
  const errors = state.errors ?? {};
  const invalid = (field: keyof typeof errors) => (errors[field] ? true : undefined);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!window.confirm(`Email this confirmation to ${data.get("clientEmail")}?`)) return;
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="grid gap-8">
      {initial.bookingUid && <input type="hidden" name="bookingUid" value={initial.bookingUid} />}

      <fieldset disabled={sending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Client</legend>
        <Field label="Name" error={errors.clientName}>
          <input name="clientName" required maxLength={120} defaultValue={initial.clientName} aria-invalid={invalid("clientName")} className={FIELD} />
        </Field>
        <Field label="Email" error={errors.clientEmail}>
          <input name="clientEmail" type="email" required maxLength={254} defaultValue={initial.clientEmail} aria-invalid={invalid("clientEmail")} className={FIELD} />
        </Field>
      </fieldset>

      <fieldset disabled={sending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Session</legend>
        <Field label="Date" error={errors.date}>
          <input name="date" type="date" required defaultValue={initial.date} aria-invalid={invalid("date")} className={FIELD} />
        </Field>
        <Field label="Start time" error={errors.time} hint="In the client's timezone">
          <input name="time" type="time" required defaultValue={initial.time} aria-invalid={invalid("time")} className={FIELD} />
        </Field>
        <Field label="Client's timezone" error={errors.clientTimeZone} hint="The email also shows Dubai time when different">
          <select name="clientTimeZone" defaultValue={initial.clientTimeZone} className={FIELD}>
            {timeZones.map((zone) => (
              <option key={zone}>{zone}</option>
            ))}
          </select>
        </Field>
        <Field label="Duration (minutes)" error={errors.durationMinutes}>
          <input name="durationMinutes" type="number" min={5} max={480} step={5} required defaultValue={initial.durationMinutes} aria-invalid={invalid("durationMinutes")} className={FIELD} />
        </Field>
        <Field label="Topic" error={errors.topic}>
          <input name="topic" list="confirmation-topics" required maxLength={120} defaultValue={initial.topic} aria-invalid={invalid("topic")} className={FIELD} />
          <datalist id="confirmation-topics">
            {topics.map((topic) => (
              <option key={topic} value={topic} />
            ))}
          </datalist>
        </Field>
        <Field label="Meeting link or location" error={errors.location} hint="https://… links become clickable">
          <input name="location" maxLength={500} defaultValue={initial.location} aria-invalid={invalid("location")} className={FIELD} />
        </Field>
        <Field label="Note to the client" error={errors.note} hint="Optional, e.g. what to prepare" className="sm:col-span-2">
          <textarea name="note" rows={3} maxLength={1000} className={`${FIELD} resize-y`} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button
          type="submit"
          disabled={sending || !emailEnabled}
          className="h-10 rounded-md bg-gold px-4 text-sm font-medium text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send confirmation"}
        </button>
        {state.sentTo && (
          <p role="status" className="text-sm text-quant">
            Sent to {state.sentTo}.
          </p>
        )}
        {state.message && (
          <p role="alert" className="text-sm text-gold">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
