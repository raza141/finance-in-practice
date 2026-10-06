"use client";

import { startTransition, useActionState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";

import { saveSettings, type SettingsFormState } from "../actions/settings";
import { SettingsContract } from "../services/SettingsContract";
import type { BillingSettings, DocumentType } from "../types";

const noSubscribe = () => () => {};
const { LIMITS } = SettingsContract;
const TYPES = Object.entries(SettingsContract.DOCUMENT_TYPES) as [DocumentType, string][];
const PLACEHOLDERS = SettingsContract.PLACEHOLDERS.map((p) => `{${p}}`).join(" ");

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="grid gap-5 rounded-lg border border-line p-5 sm:grid-cols-2">
      <legend className="px-1 text-sm text-quant">{title}</legend>
      {hint && <p className="-mt-2 text-xs text-muted sm:col-span-2">{hint}</p>}
      {children}
    </fieldset>
  );
}

/** Business details, VAT, numbering, document texts and card option. Uncontrolled, so a failed save keeps what was typed. */
export function SettingsForm({ settings }: { settings: BillingSettings }) {
  const [state, action, saving] = useActionState<SettingsFormState, FormData>(saveSettings, {});
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const errors = state.errors ?? {};

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  const input = (name: string, label: string, value: string, max: number, extra: { hint?: string; required?: boolean; type?: string } = {}) => (
    <Field label={label} error={errors[name]} hint={extra.hint}>
      <input name={name} type={extra.type ?? "text"} required={extra.required} maxLength={max} defaultValue={value} aria-invalid={errors[name] ? true : undefined} className={FIELD} />
    </Field>
  );
  const textarea = (name: string, label: string, value: string, max: number, hint?: string) => (
    <Field label={label} error={errors[name]} hint={hint} className="sm:col-span-2">
      <textarea name={name} rows={4} maxLength={max} defaultValue={value} aria-invalid={errors[name] ? true : undefined} className={`${FIELD} resize-y font-mono text-sm`} />
    </Field>
  );
  const { business, vat, card } = settings;

  return (
    <form onSubmit={submit} className="grid gap-8">
      <div className={`grid gap-8 ${saving || !hydrated ? "pointer-events-none opacity-60" : ""}`}>
        <Section title="Business details" hint="Printed in the From block of every document.">
          {input("business.name", "Business name", business.name, LIMITS.name, { required: true })}
          {input("business.sender", "Signed by", business.sender, LIMITS.sender, { required: true, hint: "Name at the end of emails and messages" })}
          {input("business.address", "Address", business.address, LIMITS.address)}
          {input("business.phone", "Phone / WhatsApp", business.phone, LIMITS.phone)}
          {input("business.email", "Email (optional)", business.email, LIMITS.email, { type: "email" })}
          {input("business.website", "Website", business.website, LIMITS.website)}
        </Section>

        <Section title="VAT" hint="Off while not VAT-registered: no VAT lines and the title stays “Invoice”. Turning it on is wired in a later step.">
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input name="vat.registered" type="checkbox" defaultChecked={vat.registered} className="size-4 accent-[var(--color-quant)]" />
            VAT registered
          </label>
          {input("vat.trn", "TRN", vat.trn, 20, { hint: "15 digits; required before VAT is turned on" })}
          {input("vat.rate", "Default VAT rate %", InvoiceMath.percent(vat.rateBp), 5)}
        </Section>

        <Section title="Defaults and numbering" hint="Numbers are assigned at issue and never reused. Existing numbers such as FIP-2026-0001 never change.">
          <Field label="Default currency" error={errors.currency}>
            <select name="currency" defaultValue={settings.currency} className={FIELD}>
              {InvoiceContract.CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <span className="hidden sm:block" />
          {TYPES.map(([type, label]) => (
            <div key={type}>{input(`prefix.${type}`, `${label} prefix`, settings.prefixes[type], 16, { required: true, hint: `${settings.prefixes[type]}-2026-0001` })}</div>
          ))}
        </Section>

        <section className="grid gap-3">
          <h2 className="text-sm text-quant">Document texts</h2>
          <p className="text-xs text-muted">
            Terms: one per line, as “Title: text”. Message placeholders: <code className="text-ink/80">{PLACEHOLDERS}</code>
          </p>
          {TYPES.map(([type, label]) => (
            <details key={type} open={type === "invoice"} className="rounded-lg border border-line p-5 [&[open]>summary]:mb-4">
              <summary className="cursor-pointer text-sm">{label}</summary>
              <div className="grid gap-5 sm:grid-cols-2">
                {textarea(`doc.${type}.terms`, "Terms", settings.documents[type].terms, LIMITS.terms)}
                {textarea(`doc.${type}.notes`, "Default notes", settings.documents[type].notes, LIMITS.notes)}
                {textarea(`doc.${type}.whatsapp`, "WhatsApp message", settings.documents[type].whatsapp, LIMITS.message)}
                {textarea(`doc.${type}.email`, "Email opening line", settings.documents[type].email, LIMITS.message)}
              </div>
            </details>
          ))}
        </section>

        <Section title="Card payments" hint="Bank transfer stays the default. When on, documents with a pasted payment link show a “Pay online” row.">
          <label className="flex items-center gap-3 text-sm sm:col-span-2">
            <input name="card.show" type="checkbox" defaultChecked={card.show} className="size-4 accent-[var(--color-quant)]" />
            Show card payment option
          </label>
          <div className="sm:col-span-2">{input("card.note", "Card note", card.note, LIMITS.cardNote)}</div>
        </Section>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving || !hydrated} className="h-10 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/25 disabled:opacity-60">
          {saving ? "Saving…" : "Save settings"}
        </button>
        {state.message && (
          <p role="alert" className="text-sm text-gold">
            {state.message}
          </p>
        )}
        {state.saved && !saving && (
          <p role="status" className="text-sm text-quant">
            Settings saved.
          </p>
        )}
      </div>
    </form>
  );
}
