"use client";

import { startTransition, useActionState, useState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { saveQuickReceipt, type QuickReceiptFormState } from "../actions/invoices";
import { InvoiceContract } from "../services/InvoiceContract";
import type { Client, Currency } from "../types";

const noSubscribe = () => () => {};

/** One session paid on the spot: issues a receipt and records the payment. No invoice. */
/** `submissionKey` is drawn once per page load, so a receipt sent twice is recorded once. */
export function QuickReceiptForm({ clients, currency, today, submissionKey }: { clients: Client[]; currency: Currency; today: string; submissionKey: string }) {
  const [state, action, saving] = useActionState<QuickReceiptFormState, FormData>(saveQuickReceipt, {});
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pending = saving || !hydrated;
  const errors = state.errors ?? {};
  const [client, setClient] = useState({ clientId: "", clientName: "", clientEmail: "", clientPhone: "" });

  const pick = (id: string) => {
    const saved = clients.find((c) => c.id === id);
    setClient(saved ? { clientId: id, clientName: saved.name, clientEmail: saved.email, clientPhone: saved.phone } : { ...client, clientId: "" });
  };
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.confirm("Issue this receipt? It gets its number and the payment is recorded.")) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="grid gap-8">
      <input type="hidden" name="submissionKey" value={submissionKey} />
      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Received from</legend>
        <Field label="Saved client" className="sm:col-span-2">
          <select name="clientId" value={client.clientId} onChange={(e) => pick(e.target.value)} className={FIELD}>
            <option value="">Someone new (type the name below)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.name, c.email || c.phone].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" error={errors.clientName}>
          <input name="clientName" required maxLength={120} value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} className={FIELD} />
        </Field>
        <Field label="Phone (optional)" error={errors.clientPhone}>
          <input name="clientPhone" type="tel" maxLength={40} value={client.clientPhone} onChange={(e) => setClient({ ...client, clientPhone: e.target.value })} className={FIELD} />
        </Field>
        <Field label="Email (optional)" error={errors.clientEmail}>
          <input name="clientEmail" type="email" maxLength={254} value={client.clientEmail} onChange={(e) => setClient({ ...client, clientEmail: e.target.value })} className={FIELD} />
        </Field>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-3">
        <legend className="mb-4 text-sm text-quant">Payment</legend>
        <Field label="Service" error={errors.service} className="sm:col-span-3">
          <input name="service" required maxLength={200} placeholder="e.g. CFA Level I session, 14 Oct" className={FIELD} />
        </Field>
        <Field label="Amount received" error={errors.payment}>
          <input name="amount" required inputMode="decimal" placeholder="450" className={FIELD} />
        </Field>
        <Field label="Currency" error={errors.currency}>
          <select name="currency" defaultValue={currency} className={FIELD}>
            {InvoiceContract.CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Received on">
          <input name="paidOn" type="date" required defaultValue={today} className={FIELD} />
        </Field>
        <Field label="Method">
          <select name="method" defaultValue="cash" className={FIELD}>
            {Object.entries(InvoiceContract.PAYMENT_METHODS).map(([value, name]) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reference (optional)">
          <input name="reference" maxLength={80} className={FIELD} />
        </Field>
      </fieldset>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="h-10 rounded-md bg-gold px-4 text-sm font-medium text-canvas transition-colors hover:bg-gold-bright disabled:opacity-60">
          {saving ? "Issuing…" : "Issue receipt"}
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
