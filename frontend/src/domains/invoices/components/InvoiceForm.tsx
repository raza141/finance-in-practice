"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings } from "@/domains/settings/types";

import { saveInvoice, type InvoiceFormState } from "../actions/invoices";
import { InvoiceContract, type DraftItem, type InvoiceFieldErrors } from "../services/InvoiceContract";
import { InvoiceMath } from "../services/InvoiceMath";
import type { BankAccount, Client, ConsultancySections, Currency, DocumentLayout, Invoice, InvoiceInput, ItemUnit, PaymentTerms } from "../types";
import { DocumentView } from "./DocumentView";

const noSubscribe = () => () => {};
const SMALL_BUTTON = "rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30";
const CUSTOM = "__custom";
const issuePrompt = (label: string) => `Issue this ${label}? It gets its number and can no longer be edited (void and duplicate it to change it).`;

/** A course offered in the line-item dropdown. */
export interface CourseOption {
  title: string;
  priceMinor: number | null;
  currency: string;
}

/** Saved records the form picks from. */
export interface InvoiceFormOptions {
  clients: Client[];
  banks: BankAccount[];
  courses: CourseOption[];
  settings: BillingSettings;
}

/** How a line's period is entered: a month picker, a date picker, or typed text. */
type PeriodKind = "month" | "date" | "text";
const PERIOD_KINDS: Record<PeriodKind, string> = { month: "Month", date: "Session date", text: "Free text" };
const periodKind = (period: string, unit: string): PeriodKind =>
  /^\d{4}-\d{2}-\d{2}$/.test(period) ? "date" : /^\d{4}-\d{2}$/.test(period) ? "month" : period ? "text" : unit === "month" ? "month" : "date";

interface Row extends DraftItem {
  key: number;
  /** Typed description rather than a course from the list. */
  custom: boolean;
  periodKind: PeriodKind;
}

let nextKey = 0;
const row = (courses: readonly CourseOption[], item?: Partial<DraftItem>): Row => {
  const description = item?.description ?? "";
  const period = item?.period ?? "";
  const unit = item?.unit ?? "hour";
  return {
    key: nextKey++,
    description,
    detail: item?.detail ?? "",
    period,
    periodKind: periodKind(period, unit),
    unit,
    quantity: item?.quantity ?? "1",
    unitPrice: item?.unitPrice ?? "",
    custom: description !== "" && !courses.some((c) => c.title === description),
  };
};

/** Create or edit a draft invoice, quote or credit note; preview it, and issue (and email) it from the same form. */
export function InvoiceForm({
  id,
  initial,
  options,
  emailEnabled,
}: {
  /** Set when editing an existing draft. */
  id?: string;
  initial: InvoiceInput;
  options: InvoiceFormOptions;
  emailEnabled: boolean;
}) {
  const { clients, banks, courses, settings } = options;
  const { docType } = initial;
  const label = SettingsContract.DOCUMENT_TYPES[docType].toLowerCase();
  const isInvoice = docType === "invoice";
  const isCredit = docType === "credit_note";
  const [state, action, saving] = useActionState<InvoiceFormState, FormData>(saveInvoice, {});
  // Disabled until hydrated, or text typed before hydration is overwritten by the initial state.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pending = saving || !hydrated;
  const [rows, setRows] = useState<Row[]>(() =>
    initial.items.length > 0
      ? initial.items.map((item) =>
          row(courses, {
            description: item.description,
            detail: item.detail,
            period: item.period,
            unit: item.unit,
            quantity: String(item.quantity),
            unitPrice: item.unitMinor ? InvoiceMath.majorInput(item.unitMinor) : "",
          }),
        )
      : [row(courses)],
  );
  const [client, setClient] = useState({
    clientId: initial.clientId ?? "",
    clientName: initial.clientName,
    clientEmail: initial.clientEmail,
    clientPhone: initial.clientPhone,
    clientAddress: initial.clientAddress,
  });
  const [bankAccountId, setBankAccountId] = useState(initial.bankAccountId ?? "");
  const [currency, setCurrency] = useState<Currency>(initial.currency);
  const [discount, setDiscount] = useState(initial.discountMinor ? InvoiceMath.majorInput(initial.discountMinor) : "");
  const vatOn = settings.vat.registered;
  const [taxRate, setTaxRate] = useState(vatOn ? InvoiceMath.percent(initial.taxRateBp || settings.vat.rateBp) : "");
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerms>(initial.paymentTerms);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [layout, setLayout] = useState<DocumentLayout>(initial.layout);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [previewErrors, setPreviewErrors] = useState<InvoiceFieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const errors = previewErrors ?? state.errors ?? {};
  const message = previewErrors ? "Fix the highlighted fields to preview." : state.message;
  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  /** A unit's default rate (Settings) fills an empty price; milestones switch to the consultancy layout. */
  const pickUnit = (r: Row, unit: ItemUnit) => {
    const rate = settings.units[unit].rateMinor;
    update(r.key, { unit, ...(rate !== null && !r.unitPrice && { unitPrice: InvoiceMath.majorInput(rate) }) });
    if (unit === "milestone") setLayout("consultancy");
  };
  /** Terms set the due date from today; the date stays editable. */
  const pickTerms = (terms: PaymentTerms) => {
    setPaymentTerms(terms);
    setDueDate(InvoiceContract.dueDate(terms, new Date().toISOString().slice(0, 10)));
  };
  const bank = banks.find((b) => b.id === bankAccountId);

  // Running totals only: the server recomputes every amount.
  const amounts = rows.map((r) => {
    const unit = InvoiceMath.parseMajor(r.unitPrice);
    const quantity = Number(r.quantity);
    return unit !== null && quantity > 0 ? InvoiceMath.lineAmount(quantity, unit) : 0;
  });
  const taxBp = Math.round(Number(taxRate) * 100) || 0;
  const totals = InvoiceMath.totals(amounts, InvoiceMath.parseMajor(discount) ?? 0, taxBp);
  const money = (minor: number) => InvoiceMath.money(minor, currency);

  const pickClient = (clientId: string) => {
    const saved = clients.find((c) => c.id === clientId);
    // Start from the client's courses and payment plan, unless lines were already filled in.
    if (saved && saved.courses.length > 0 && rows.every((r) => !r.description && !r.unitPrice)) {
      setCurrency(saved.planCurrency);
      setRows(
        InvoiceContract.planItems(saved).map((item) =>
          row(courses, { description: item.description, unit: item.unit, quantity: "1", unitPrice: item.unitMinor ? InvoiceMath.majorInput(item.unitMinor) : "" }),
        ),
      );
    }
    setClient(
      saved
        ? { clientId, clientName: saved.name, clientEmail: saved.email, clientPhone: saved.phone, clientAddress: saved.address }
        : { ...client, clientId: "" },
    );
  };

  const pickCourse = (r: Row, value: string) => {
    if (value === CUSTOM) return update(r.key, { custom: true, description: "" });
    const course = courses.find((c) => c.title === value);
    // Prefill the course fee (a whole-course price, so billed as a contract) only when it
    // is in the invoice currency and no price is typed yet.
    if (course?.priceMinor && course.currency === currency && !r.unitPrice) {
      return update(r.key, { custom: false, description: value, unitPrice: InvoiceMath.majorInput(course.priceMinor), unit: "fee", quantity: "1" });
    }
    update(r.key, { custom: false, description: value });
  };

  /** Validates with the server's own rules, then shows the invoice exactly as it would be issued. */
  const openPreview = () => {
    if (!formRef.current) return;
    const parsed = InvoiceContract.parseInvoice(Object.fromEntries(new FormData(formRef.current)));
    if (!parsed.ok) {
      setPreviewErrors(parsed.errors);
      return;
    }
    setPreviewErrors(null);
    const { input } = parsed;
    setPreview({
      ...input,
      trn: vatOn ? settings.vat.trn : "",
      taxRateBp: vatOn ? input.taxRateBp : 0,
      ...InvoiceMath.totals(input.items.map((item) => item.amountMinor), input.discountMinor, input.taxRateBp),
      id: id ?? "",
      number: null,
      relatedNumber: null,
      paymentId: null,
      recursFrom: null,
      linkValidUntil: null,
      creditedMinor: 0,
      receiptPayment: null,
      token: "",
      status: "draft",
      issueDate: null,
      createdAt: new Date(),
      sentAt: null,
      paidAt: null,
      voidedAt: null,
      paidMinor: 0,
      payments: [],
      viewCount: 0,
      firstViewedAt: null,
      lastViewedAt: null,
      bank: bank ?? null,
    });
    dialogRef.current?.showModal();
  };

  // onSubmit, not <form action>: React resets a form after an action, which would
  // lose what was typed when validation fails. The clicked button carries the intent.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const intent = submitter?.getAttribute("value");
    if ((intent === "issue" || intent === "send") && !window.confirm(issuePrompt(label))) return;
    const data = new FormData(event.currentTarget, submitter);
    dialogRef.current?.close();
    setPreviewErrors(null);
    startTransition(() => action(data));
  };

  const issueButtons = (
    <>
      <button
        type="submit"
        name="intent"
        value="send"
        disabled={pending || !emailEnabled || !client.clientEmail.trim()}
        title={!emailEnabled ? "Email is not configured" : client.clientEmail.trim() ? undefined : "Add the client's email to send it, or issue and share on WhatsApp"}
        className="h-10 rounded-md bg-gold px-4 text-sm font-medium text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
      >
        Issue &amp; email {label}
      </button>
      <button type="submit" name="intent" value="issue" disabled={pending} className="h-10 rounded-md border border-line px-4 text-sm text-muted transition-colors hover:text-ink disabled:opacity-60">
        Issue without emailing
      </button>
    </>
  );

  return (
    <form ref={formRef} onSubmit={submit} className="grid gap-8">
      {id && <input type="hidden" name="id" value={id} />}
      {initial.bookingUid && <input type="hidden" name="bookingUid" value={initial.bookingUid} />}
      <input type="hidden" name="docType" value={docType} />
      {initial.relatedId && <input type="hidden" name="relatedId" value={initial.relatedId} />}
      <input type="hidden" name="layout" value={layout} />

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Bill to</legend>
        <Field label="Saved client" error={errors.clientId} hint={<Link href="/admin/clients" className="hover:text-ink">Manage clients →</Link>} className="sm:col-span-2">
          <select name="clientId" value={client.clientId} onChange={(e) => pickClient(e.target.value)} className={FIELD}>
            <option value="">New client (type the details below)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {[c.name, c.email || c.phone].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Client name" error={errors.clientName}>
          <input name="clientName" required maxLength={120} value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} aria-invalid={errors.clientName ? true : undefined} className={FIELD} />
        </Field>
        <Field label="Client email (optional)" error={errors.clientEmail}>
          <input name="clientEmail" type="email" maxLength={254} value={client.clientEmail} onChange={(e) => setClient({ ...client, clientEmail: e.target.value })} aria-invalid={errors.clientEmail ? true : undefined} className={FIELD} />
        </Field>
        <Field label="Phone" error={errors.clientPhone}>
          <input name="clientPhone" type="tel" maxLength={40} value={client.clientPhone} onChange={(e) => setClient({ ...client, clientPhone: e.target.value })} className={FIELD} />
        </Field>
        <Field label="Address" error={errors.clientAddress}>
          <textarea name="clientAddress" rows={2} maxLength={500} value={client.clientAddress} onChange={(e) => setClient({ ...client, clientAddress: e.target.value })} className={`${FIELD} resize-y`} />
        </Field>
        {!client.clientId && (
          <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
            <input type="checkbox" name="saveClient" defaultChecked className="accent-quant" />
            Save to my clients when I save this {label}
          </label>
        )}
      </fieldset>

      <fieldset disabled={pending}>
        <legend className="mb-4 flex w-full flex-wrap items-center justify-between gap-3 text-sm text-quant">
          {layout === "consultancy" ? "Fees" : "Line items"}
          <label className="flex items-center gap-2 text-xs text-muted">
            Layout
            <select value={layout} onChange={(e) => setLayout(e.target.value as DocumentLayout)} className="rounded-md border border-line bg-canvas/70 px-2 py-1 text-ink">
              {Object.entries(InvoiceContract.LAYOUTS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </legend>
        <input type="hidden" name="items" value={JSON.stringify(rows.map(({ description, detail, period, unit, quantity, unitPrice }) => ({ description, detail, period, unit, quantity, unitPrice })))} />
        <div className="hidden grid-cols-[1fr_8rem_5rem_8rem_8rem_4rem] gap-3 px-1 text-[11px] tracking-[0.18em] text-muted uppercase sm:grid">
          <span>Course</span>
          <span>Basis</span>
          <span>Qty</span>
          <span>Unit price</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ol className="mt-2 grid gap-4">
          {rows.map((r, index) => (
            <li key={r.key} className="grid gap-2 border-b border-line/60 pb-4 sm:grid-cols-[1fr_8rem_5rem_8rem_8rem_4rem] sm:items-center sm:gap-3">
              <div className="grid gap-2">
                <select aria-label={`Line ${index + 1} course`} value={r.custom ? CUSTOM : r.description} onChange={(e) => pickCourse(r, e.target.value)} className={`${FIELD} mt-0`}>
                  <option value="" disabled>
                    Choose a course…
                  </option>
                  {courses.map((c, i) => (
                    <option key={i} value={c.title}>
                      {c.title}
                    </option>
                  ))}
                  <option value={CUSTOM}>Other (type a description)</option>
                </select>
                {r.custom && (
                  <input aria-label={`Line ${index + 1} description`} placeholder="Description" maxLength={200} value={r.description} onChange={(e) => update(r.key, { description: e.target.value })} className={`${FIELD} mt-0`} />
                )}
              </div>
              <select aria-label={`Line ${index + 1} billing basis`} value={r.unit} onChange={(e) => pickUnit(r, e.target.value as ItemUnit)} className={`${FIELD} mt-0`}>
                {(Object.entries(InvoiceContract.UNITS) as [ItemUnit, string][])
                  .filter(([value]) => value !== "milestone" || layout === "consultancy" || r.unit === "milestone")
                  .map(([value, name]) => (
                    <option key={value} value={value}>
                      {name}
                    </option>
                  ))}
              </select>
              <input aria-label={`Line ${index + 1} quantity`} inputMode="decimal" value={r.quantity} onChange={(e) => update(r.key, { quantity: e.target.value })} className={`${FIELD} mt-0`} />
              <input aria-label={`Line ${index + 1} unit price`} inputMode="decimal" placeholder="0.00" value={r.unitPrice} onChange={(e) => update(r.key, { unitPrice: e.target.value })} className={`${FIELD} mt-0`} />
              <span className="text-right font-mono text-sm tabular-nums">{money(amounts[index])}</span>
              <button type="button" disabled={rows.length === 1} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))} className={SMALL_BUTTON}>
                Remove
              </button>
              <input
                aria-label={`Line ${index + 1} details`}
                placeholder="Details shown under the course (optional), e.g. 8 sessions, 6–30 Oct"
                maxLength={200}
                value={r.detail}
                onChange={(e) => update(r.key, { detail: e.target.value })}
                className={`${FIELD} mt-0 text-sm sm:col-span-3`}
              />
              <div className="grid grid-cols-[8rem_1fr] gap-2 sm:col-span-2">
                <select
                  aria-label={`Line ${index + 1} period type`}
                  value={r.periodKind}
                  onChange={(e) => update(r.key, { periodKind: e.target.value as PeriodKind, period: "" })}
                  className={`${FIELD} mt-0 text-sm`}
                >
                  {Object.entries(PERIOD_KINDS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  aria-label={`Line ${index + 1} period`}
                  type={r.periodKind === "text" ? "text" : r.periodKind}
                  placeholder={r.periodKind === "text" ? "e.g. 6–30 Oct 2026" : undefined}
                  maxLength={60}
                  value={r.period}
                  onChange={(e) => update(r.key, { period: e.target.value })}
                  className={`${FIELD} mt-0 text-sm`}
                />
              </div>
            </li>
          ))}
        </ol>
        {errors.items && (
          <p role="alert" className="mt-2 text-xs text-gold">
            {errors.items}
          </p>
        )}
        <button type="button" disabled={rows.length >= InvoiceContract.LIMITS.items} onClick={() => setRows((list) => [...list, row(courses)])} className="mt-3 text-sm text-quant hover:underline disabled:opacity-40">
          + Add line
        </button>
      </fieldset>

      {layout === "consultancy" && (
        <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
          <legend className="mb-4 text-sm text-quant">Consultancy sections</legend>
          {(Object.entries(InvoiceContract.SECTIONS) as [keyof ConsultancySections, string][]).map(([key, name]) => (
            <Field key={key} label={name} hint={key === "scope" || key === "deliverables" ? "Printed before the fees" : "Printed after the fees"}>
              <textarea name={`section.${key}`} rows={4} maxLength={2000} defaultValue={initial.sections[key]} className={`${FIELD} resize-y`} />
            </Field>
          ))}
          {errors.sections && (
            <p role="alert" className="text-xs text-gold sm:col-span-2">
              {errors.sections}
            </p>
          )}
        </fieldset>
      )}

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-3">
        <legend className="mb-4 text-sm text-quant">Amounts</legend>
        <Field label="Currency" error={errors.currency}>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={FIELD}>
            {InvoiceContract.CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Discount (amount)" error={errors.discountMinor} hint="Optional, taken off before VAT">
          <input name="discount" inputMode="decimal" placeholder="0" value={discount} onChange={(e) => setDiscount(e.target.value)} aria-invalid={errors.discountMinor ? true : undefined} className={FIELD} />
        </Field>
        {vatOn ? (
          <Field label="VAT %" error={errors.taxRateBp} hint={`TRN ${settings.vat.trn} is printed from Settings`}>
            <input name="taxRate" inputMode="decimal" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} aria-invalid={errors.taxRateBp ? true : undefined} className={FIELD} />
          </Field>
        ) : (
          <input type="hidden" name="taxRate" value="" />
        )}
        {isInvoice && (
          <Field label="Payment terms" error={errors.paymentTerms} hint="Sets the due date from today">
            <select name="paymentTerms" value={paymentTerms} onChange={(e) => pickTerms(e.target.value as PaymentTerms)} className={FIELD}>
              {Object.entries(InvoiceContract.PAYMENT_TERMS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!isInvoice && <input type="hidden" name="paymentTerms" value={paymentTerms} />}
        <Field label={docType === "quote" ? "Valid until" : isCredit ? "Credit date" : "Due date"} error={errors.dueDate}>
          <input name="dueDate" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={errors.dueDate ? true : undefined} className={FIELD} />
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
              <dt className="text-muted">VAT {taxRate}%</dt>
              <dd className="text-right">{money(totals.taxMinor)}</dd>
            </>
          )}
          <dt className="text-ink">Total</dt>
          <dd className="text-right text-gold">{money(totals.totalMinor)}</dd>
        </dl>
        {isInvoice && (
          <label className="flex items-center gap-2 self-center text-sm text-muted">
            <input type="checkbox" name="recurring" defaultChecked={initial.recurring} className="accent-quant" />
            Repeats monthly (offered under “Create this month’s drafts”)
          </label>
        )}
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">{isInvoice ? "Payment details" : "Notes"}</legend>
        {isInvoice && (
          <>
            <Field
              label="Bank account"
              error={errors.bankAccountId}
              hint={
                <Link href="/admin/invoices/banks" className="hover:text-ink">
                  {banks.length === 0 ? "Add your bank details →" : "Manage bank accounts →"}
                </Link>
              }
            >
              <select name="bankAccountId" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)} className={FIELD}>
                <option value="">No bank details</option>
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bankName} {b.iban ? `· ${b.iban}` : b.accountNumber && `· ${b.accountNumber}`}
                    {b.isDefault ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {settings.card.show ? (
              <Field label="Payment link (optional)" error={errors.paymentLink} hint="A card / online link from any provider. Printed as “Pay online”.">
                <input name="paymentLink" type="url" maxLength={500} placeholder="https://" defaultValue={initial.paymentLink} className={FIELD} />
              </Field>
            ) : (
              <input type="hidden" name="paymentLink" value={initial.paymentLink} />
            )}
            <Field label="Other payment instructions" error={errors.paymentInstructions} hint="Optional. Printed under the bank details." className="sm:col-span-2">
              <textarea name="paymentInstructions" rows={2} maxLength={2000} defaultValue={initial.paymentInstructions} className={`${FIELD} resize-y`} />
            </Field>
          </>
        )}
        <Field label="Notes" error={errors.notes} hint="Optional. The terms come from Settings." className="sm:col-span-2">
          <textarea name="notes" rows={3} maxLength={2000} defaultValue={initial.notes} className={`${FIELD} resize-y`} />
        </Field>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button type="button" onClick={openPreview} disabled={pending} className="h-10 rounded-md border border-quant/50 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/10 disabled:opacity-60">
          Preview {label}
        </button>
        <button type="submit" name="intent" value="save" disabled={pending} className="h-10 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/25 disabled:opacity-60">
          {saving ? "Saving…" : "Save draft"}
        </button>
        {issueButtons}
        {message && (
          <p role="alert" className="text-sm text-gold">
            {message}
          </p>
        )}
      </div>

      <dialog ref={dialogRef} onClose={() => setPreview(null)} aria-label="Preview" className="m-auto max-h-[94vh] w-[96vw] max-w-[52rem] rounded-lg bg-slate-200 p-0 backdrop:bg-black/70">
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-line bg-canvas px-4 py-3">
          <p className="mr-auto text-sm text-muted">Preview: this is how the client will see it.</p>
          <button type="button" onClick={() => dialogRef.current?.close()} className="h-10 rounded-md border border-line px-4 text-sm text-ink hover:border-quant">
            Back to editing
          </button>
          {issueButtons}
        </div>
        <div className="p-3 sm:p-6">{preview && <DocumentView doc={preview} settings={settings} />}</div>
      </dialog>
    </form>
  );
}
