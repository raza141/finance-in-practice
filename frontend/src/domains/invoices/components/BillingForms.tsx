"use client";

import { startTransition, useActionState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { saveBank, saveClient } from "../actions/billing";
import { InvoiceContract } from "../services/InvoiceContract";
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
}: {
  id?: string;
  fields: readonly FieldSpec[];
  values: Partial<Record<string, string>>;
  save: (state: FormState, data: FormData) => Promise<FormState>;
  submitLabel: string;
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

export function ClientForm({ client }: { client?: Client }) {
  return <RecordForm id={client?.id} fields={CLIENT_FIELDS} values={{ ...client }} save={saveClient} submitLabel={client ? "Save client" : "Add client"} />;
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
