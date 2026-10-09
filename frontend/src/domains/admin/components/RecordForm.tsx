"use client";

import { startTransition, useActionState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { FIELD, Field } from "./FormField";

const noSubscribe = () => () => {};

export interface FieldSpec {
  name: string;
  label: string;
  maxLength: number;
  required?: boolean;
  type?: string;
  hint?: string;
  multiline?: boolean;
}

export type FormState = { message?: string; errors?: Partial<Record<string, string>> };

/**
 * Plain text-field record form. Fields are uncontrolled; submitting via
 * onSubmit (not <form action>) stops React resetting them on a failed save.
 */
export function RecordForm({
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
