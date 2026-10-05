"use client";

import { startTransition, useActionState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { saveBank, saveClient } from "../actions/billing";
import { InvoiceContract } from "../services/InvoiceContract";
import { InvoiceMath } from "../services/InvoiceMath";
import type { BankAccount, Client } from "../types";

const noSubscribe = () => () => {};

interface FieldSpec {
  name: string;
  label: string;
  maxLength: number;
  required?: boolean;
  type?: string;
  hint?: string;
  multiline?: boolean;
}

type FormState = { message?: string; errors?: Partial<Record<string, string>> };

/**
 * Plain text-field record form. Fields are uncontrolled; submitting via
 * onSubmit (not <form action>) stops React resetting them on a failed save.
 */
function RecordForm({
  id,
  fields,
  values,
  save,
  submitLabel,
  extra,
}: {
  id?: string;
  fields: readonly FieldSpec[];
  values: Partial<Record<string, string>>;
  save: (state: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
  /** More controls after the text fields, given the current field errors. */
  extra?: (errors: Partial<Record<string, string>>) => ReactNode;
}) {
  const [state, action, saving] = useActionState<FormState, FormData>(save, {});
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const errors = state.errors ?? {};

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="grid gap-6">
      {id && <input type="hidden" name="id" value={id} />}
      <fieldset disabled={saving || !hydrated} className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.name} label={f.label} error={errors[f.name]} hint={f.hint} className={f.multiline ? "sm:col-span-2" : ""}>
            {f.multiline ? (
              <textarea name={f.name} rows={3} maxLength={f.maxLength} defaultValue={values[f.name]} aria-invalid={errors[f.name] ? true : undefined} className={`${FIELD} resize-y`} />
            ) : (
              <input
                name={f.name}
                type={f.type ?? "text"}
                required={f.required}
                maxLength={f.maxLength}
                defaultValue={values[f.name]}
                aria-invalid={errors[f.name] ? true : undefined}
                className={FIELD}
              />
            )}
          </Field>
        ))}
      </fieldset>
      {extra && <fieldset disabled={saving || !hydrated}>{extra(errors)}</fieldset>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !hydrated} className="h-10 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/25 disabled:opacity-60">
          {saving ? "Saving…" : submitLabel}
        </button>
        {state.message && (
          <p role="alert" className="text-sm text-gold">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

const { LIMITS } = InvoiceContract;

const CLIENT_FIELDS: readonly FieldSpec[] = [
  { name: "name", label: "Name", maxLength: LIMITS.name, required: true, hint: "Person or company" },
  { name: "email", label: "Email", maxLength: LIMITS.email, required: true, type: "email" },
  { name: "phone", label: "Phone", maxLength: LIMITS.phone, type: "tel" },
  { name: "address", label: "Address", maxLength: LIMITS.address, multiline: true },
];

const BANK_FIELDS: readonly FieldSpec[] = [
  { name: "bankName", label: "Bank name", maxLength: LIMITS.bank.bankName, required: true },
  { name: "accountTitle", label: "Account title", maxLength: LIMITS.bank.accountTitle, hint: "Name the account is held in" },
  { name: "accountNumber", label: "Account number", maxLength: LIMITS.bank.accountNumber },
  { name: "iban", label: "IBAN", maxLength: LIMITS.bank.iban },
  { name: "branch", label: "Branch", maxLength: LIMITS.bank.branch },
  { name: "swift", label: "SWIFT / BIC", maxLength: LIMITS.bank.swift, hint: "For payments from abroad" },
];

/** Contact details, the courses they take and their payment plan. `courses` are the catalogue titles to tick. */
export function ClientForm({ client, courses }: { client?: Client; courses: readonly string[] }) {
  // Keep a course the client has even if it was renamed or removed from the catalogue.
  const options = [...new Set([...courses, ...(client?.courses ?? [])])];
  const { name, email, phone, address } = client ?? {};
  return (
    <RecordForm
      id={client?.id}
      fields={CLIENT_FIELDS}
      values={{ name, email, phone, address }}
      save={saveClient}
      submitLabel={client ? "Save client" : "Add client"}
      extra={(errors) => (
        <div className="grid gap-8">
          <div>
            <p className="mb-3 text-sm text-quant">Courses</p>
            {options.length === 0 ? (
              <p className="text-sm text-muted">No courses yet. Add them under Courses.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((title) => (
                  <label key={title} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="courses" value={title} defaultChecked={client?.courses.includes(title)} className="accent-quant" />
                    {title}
                  </label>
                ))}
              </div>
            )}
            {errors.courses && (
              <p role="alert" className="mt-2 text-xs text-gold">
                {errors.courses}
              </p>
            )}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <p className="text-sm text-quant sm:col-span-3">Payment plan (optional)</p>
            <Field label="Billed" error={errors.planUnit}>
              <select name="planUnit" defaultValue={client?.planUnit ?? ""} className={FIELD}>
                <option value="">No plan</option>
                {Object.entries(InvoiceContract.UNITS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Fee per course" error={errors.planFeeMinor} hint="Per hour, month or contract">
              <input
                name="planFee"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={client?.planFeeMinor != null ? InvoiceMath.majorInput(client.planFeeMinor) : ""}
                aria-invalid={errors.planFeeMinor ? true : undefined}
                className={FIELD}
              />
            </Field>
            <Field label="Currency" error={errors.planCurrency}>
              <select name="planCurrency" defaultValue={client?.planCurrency ?? "AED"} className={FIELD}>
                {InvoiceContract.CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Plan notes" error={errors.planNotes} hint="e.g. 3 instalments, due on the 1st of each month" className="sm:col-span-3">
              <textarea name="planNotes" rows={2} maxLength={InvoiceContract.LIMITS.planNotes} defaultValue={client?.planNotes} className={`${FIELD} resize-y`} />
            </Field>
          </div>
        </div>
      )}
    />
  );
}

export function BankForm({ account }: { account?: BankAccount }) {
  return (
    <RecordForm
      id={account?.id}
      fields={BANK_FIELDS}
      values={{ ...account, isDefault: undefined }}
      save={saveBank}
      submitLabel={account ? "Save bank" : "Add bank"}
    />
  );
}
