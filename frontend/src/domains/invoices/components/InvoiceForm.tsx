"use client";

import { startTransition, useActionState, useState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { saveInvoice, type InvoiceFormState } from "../actions/invoices";
import { InvoiceContract, type DraftItem } from "../services/InvoiceContract";
import { InvoiceMath } from "../services/InvoiceMath";
import type { Currency, InvoiceInput } from "../types";

const noSubscribe = () => () => {};
const SMALL_BUTTON = "rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30";

interface Row extends DraftItem {
  key: number;
}

let nextKey = 0;
const row = (item?: Partial<DraftItem>): Row => ({
  key: nextKey++,
  description: item?.description ?? "",
  quantity: item?.quantity ?? "1",
  unitPrice: item?.unitPrice ?? "",
});

/** Create or edit a draft invoice; the same form issues it (and emails it) in one step. */
export function InvoiceForm({
  id,
  initial,
  emailEnabled,
}: {
  /** Set when editing an existing draft. */
  id?: string;
  initial: InvoiceInput;
  emailEnabled: boolean;
}) {
  const [state, action, saving] = useActionState<InvoiceFormState, FormData>(saveInvoice, {});
  // Disabled until hydrated, or text typed before hydration is overwritten by the initial state.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pending = saving || !hydrated;
  const [rows, setRows] = useState<Row[]>(() =>
    initial.items.length > 0
      ? initial.items.map((item) => row({ description: item.description, quantity: String(item.quantity), unitPrice: item.unitMinor ? InvoiceMath.majorInput(item.unitMinor) : "" }))
      : [row()],
  );
  const [currency, setCurrency] = useState<Currency>(initial.currency);
  const [discount, setDiscount] = useState(initial.discountMinor ? InvoiceMath.majorInput(initial.discountMinor) : "");
  const [taxRate, setTaxRate] = useState(initial.taxRateBp ? InvoiceMath.percent(initial.taxRateBp) : "");

  const errors = state.errors ?? {};
  const update = (key: number, patch: Partial<DraftItem>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Preview only: the server recomputes every amount.
  const amounts = rows.map((r) => {
    const unit = InvoiceMath.parseMajor(r.unitPrice);
    const quantity = Number(r.quantity);
    return unit !== null && quantity > 0 ? InvoiceMath.lineAmount(quantity, unit) : 0;
  });
  const taxBp = Math.round(Number(taxRate) * 100) || 0;
  const totals = InvoiceMath.totals(amounts, InvoiceMath.parseMajor(discount) ?? 0, taxBp);
  const money = (minor: number) => InvoiceMath.money(minor, currency);

  // onSubmit, not <form action>: React resets a form after an action, which would
  // lose what was typed when validation fails. The clicked button carries the intent.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter?.getAttribute("value");
    if ((intent === "issue" || intent === "send") && !window.confirm("Issue this invoice? It gets its number and can no longer be edited (void and duplicate it to change it).")) {
      return;
    }
    const data = new FormData(event.currentTarget, submitter);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="grid gap-8">
      {id && <input type="hidden" name="id" value={id} />}
      {initial.bookingUid && <input type="hidden" name="bookingUid" value={initial.bookingUid} />}

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Bill to</legend>
        <Field label="Client name" error={errors.clientName}>
          <input name="clientName" required maxLength={120} defaultValue={initial.clientName} aria-invalid={errors.clientName ? true : undefined} className={FIELD} />
        </Field>
        <Field label="Client email" error={errors.clientEmail}>
          <input name="clientEmail" type="email" required maxLength={254} defaultValue={initial.clientEmail} aria-invalid={errors.clientEmail ? true : undefined} className={FIELD} />
        </Field>
      </fieldset>

      <fieldset disabled={pending}>
        <legend className="mb-4 text-sm text-quant">Line items</legend>
        <input type="hidden" name="items" value={JSON.stringify(rows.map(({ description, quantity, unitPrice }) => ({ description, quantity, unitPrice })))} />
        <div className="hidden grid-cols-[1fr_6rem_9rem_9rem_4rem] gap-3 px-1 text-[11px] tracking-[0.18em] text-muted uppercase sm:grid">
          <span>Description</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ol className="mt-2 grid gap-3">
          {rows.map((r, index) => (
            <li key={r.key} className="grid gap-3 sm:grid-cols-[1fr_6rem_9rem_9rem_4rem] sm:items-center">
              <input aria-label={`Line ${index + 1} description`} placeholder="CFA Level I tutoring, 6 Oct" maxLength={200} value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} className={`${FIELD} mt-0`} />
              <input aria-label={`Line ${index + 1} quantity`} inputMode="decimal" value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} className={`${FIELD} mt-0`} />
              <input aria-label={`Line ${index + 1} unit price`} inputMode="decimal" placeholder="0.00" value={r.unitPrice} onChange={(e) => update(r.key, { unitPrice: e.target.value })} className={`${FIELD} mt-0`} />
              <span className="text-right font-mono text-sm tabular-nums">{money(amounts[index])}</span>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} className={SMALL_BUTTON}>
                Remove
              </button>
            </li>
          ))}
        </ol>
        {errors.items && (
          <p role="alert" className="mt-2 text-xs text-gold">
            {errors.items}
          </p>
        )}
        <button type="button" disabled={rows.length >= InvoiceContract.LIMITS.items} onClick={() => setRows((list) => [...list, row()])} className="mt-3 text-sm text-quant hover:underline disabled:opacity-40">
          + Add line
        </button>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-3">
        <legend className="mb-4 text-sm text-quant">Amounts</legend>
        <Field label="Currency" error={errors.currency}>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={FIELD}>
            {InvoiceContract.CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Discount (amount)" error={errors.discountMinor} hint="Optional, taken off before tax">
          <input name="discount" inputMode="decimal" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-invalid={errors.discountMinor ? true : undefined} className={FIELD} />
        </Field>
        <Field label="VAT / tax %" error={errors.taxRateBp} hint="Leave empty if not VAT-registered">
          <input name="taxRate" inputMode="decimal" placeholder="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} aria-invalid={errors.taxRateBp ? true : undefined} className={FIELD} />
        </Field>
        <Field label="TRN" error={errors.trn} hint="Your tax registration number, if any">
          <input name="trn" maxLength={30} defaultValue={initial.trn} className={FIELD} />
        </Field>
        <Field label="Due date" error={errors.dueDate}>
          <input name="dueDate" type="date" required defaultValue={initial.dueDate} aria-invalid={errors.dueDate ? true : undefined} className={FIELD} />
        </Field>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-end rounded-md border border-line p-3 font-mono text-sm tabular-nums">
          <dt className="text-muted">Subtotal</dt>
          <dd className="text-right">{money(totals.subtotalMinor)}</dd>
          {totals.discountMinor > 0 && (
            <>
              <dt className="text-muted">Discount</dt>
              <dd className="text-right">−{money(totals.discountMinor)}</dd>
            </>
          )}
          {taxBp > 0 && (
            <>
              <dt className="text-muted">Tax {taxRate}%</dt>
              <dd className="text-right">{money(totals.taxMinor)}</dd>
            </>
          )}
          <dt className="text-ink">Total</dt>
          <dd className="text-right text-gold">{money(totals.totalMinor)}</dd>
        </dl>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Notes</legend>
        <Field label="Payment instructions" error={errors.paymentInstructions} hint="Bank transfer details etc. Prefilled from your last invoice.">
          <textarea name="paymentInstructions" rows={5} maxLength={2000} defaultValue={initial.paymentInstructions} className={`${FIELD} resize-y`} />
        </Field>
        <Field label="Notes" error={errors.notes} hint="Optional, shown on the invoice">
          <textarea name="notes" rows={5} maxLength={2000} defaultValue={initial.notes} className={`${FIELD} resize-y`} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button type="submit" name="intent" value="save" disabled={pending} className="h-10 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/25 disabled:opacity-60">
          {saving ? "Saving…" : "Save draft"}
        </button>
        <button
          type="submit"
          name="intent"
          value="send"
          disabled={pending || !emailEnabled}
          title={emailEnabled ? undefined : "Email is not configured"}
          className="h-10 rounded-md bg-gold px-4 text-sm font-medium text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
        >
          Issue &amp; email to client
        </button>
        <button type="submit" name="intent" value="issue" disabled={pending} className="h-10 rounded-md border border-line px-4 text-sm text-muted transition-colors hover:text-ink disabled:opacity-60">
          Issue without emailing
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
