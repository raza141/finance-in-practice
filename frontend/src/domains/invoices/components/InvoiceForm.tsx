"use client";

import Link from "next/link";
import { startTransition, useActionState, useRef, useState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import type { Service } from "@/domains/catalogue/types";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings } from "@/domains/settings/types";

import { saveInvoice, type InvoiceFormState } from "../actions/invoices";
import type { IssueWarnings } from "../server/IssueChecks";
import { InvoiceContract, type InvoiceFieldErrors } from "../services/InvoiceContract";
import { InvoiceEmails } from "../services/InvoiceEmails";
import { InvoiceMath } from "../services/InvoiceMath";
import { LinePricing } from "../services/LinePricing";
import type { Agreement, BankAccount, Client, ConsultancySections, Currency, DocumentLayout, Invoice, InvoiceInput, ItemUnit, PaymentTerms } from "../types";
import { DocumentView } from "./DocumentView";
import { BASIS, LineEditor, periodKind, toDraft, toRow, type Row } from "./LineEditor";

const noSubscribe = () => () => {};
const issuePrompt = (label: string) => `Issue this ${label}? It gets its number and can no longer be edited (void and duplicate it to change it).`;

/** A course offered in the line search, with its whole-course fee. */
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
  /** Active services, plus archived ones the document already uses. */
  services: Service[];
  /** Live client agreements (all clients; filtered per line). */
  agreements: Agreement[];
  settings: BillingSettings;
}

/**
 * Create or edit a draft invoice, quote or credit note; preview it, and issue
 * (and email, or record its payment) from the same form. Prices come from an
 * agreement the user picks, else the catalogue, else they are typed; the source
 * shows on each line and the server re-checks it.
 */
export function InvoiceForm({
  id,
  initial,
  options,
  emailEnabled,
  submissionKey,
  warnings,
}: {
  /** Set when editing an existing draft. */
  id?: string;
  initial: InvoiceInput;
  options: InvoiceFormOptions;
  emailEnabled: boolean;
  /** One per page load: "Issue & record payment" sent twice records one payment. */
  submissionKey: string;
  /** Possible double billing and changes from the accepted quote, to confirm before issuing. */
  warnings?: IssueWarnings;
}) {
  const { clients, banks, courses, services, agreements, settings } = options;
  const { docType } = initial;
  const label = SettingsContract.DOCUMENT_TYPES[docType].toLowerCase();
  const isInvoice = docType === "invoice";
  const isCredit = docType === "credit_note";
  const isQuote = docType === "quote";
  const [state, action, saving] = useActionState<InvoiceFormState, FormData>(saveInvoice, {});
  // Disabled until hydrated, or text typed before hydration is overwritten by the initial state.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pending = saving || !hydrated;
  const [rows, setRows] = useState<Row[]>(() => (initial.items.length > 0 ? initial.items.map((item) => toRow(item)) : [toRow()]));
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
  const [termsDays, setTermsDays] = useState(initial.termsDays === null ? "" : String(initial.termsDays));
  /** Terms changed by hand: picking a client or an agreement no longer resets them. */
  const [termsTouched, setTermsTouched] = useState(Boolean(id));
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [layout, setLayout] = useState<DocumentLayout>(initial.layout);
  const [paying, setPaying] = useState(false);
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [previewErrors, setPreviewErrors] = useState<InvoiceFieldErrors | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const errors = previewErrors ?? state.errors ?? {};
  const message = previewErrors ? "Fix the highlighted fields to preview." : state.message;
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const update = (key: number, patch: Partial<Row>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const serviceOf = (r: Row) => services.find((s) => s.id === r.serviceId);
  const lineDate = (r: Row) => LinePricing.periodStart(r.period) ?? today;
  const setTerms = (choice: { terms: PaymentTerms; days: number | null }) => {
    setPaymentTerms(choice.terms);
    setTermsDays(choice.days === null ? "" : String(choice.days));
  };

  /**
   * The price a line gets for a basis and currency: the catalogue's for a
   * service line (else empty, never another basis's rate), the Settings rate
   * for a custom line in the default currency. Agreements are only applied by
   * picking one.
   */
  const priced = (r: Row, unit: ItemUnit, cur: Currency): Partial<Row> => {
    const fixed = BASIS[unit].quantity === null ? { quantity: "1" } : {};
    const service = serviceOf(r);
    if (service) {
      const price = LinePricing.cataloguePrice(service, unit, cur, lineDate(r));
      return { unit, ...fixed, unitPrice: price ? InvoiceMath.majorInput(price.rateMinor) : "", pricingSource: price ? "catalogue" : "manual", agreementId: "" };
    }
    const rate = settings.units[unit].rateMinor;
    return { unit, ...fixed, unitPrice: rate !== null && cur === settings.currency ? InvoiceMath.majorInput(rate) : "", pricingSource: "manual", agreementId: "" };
  };

  const pickUnit = (r: Row, unit: ItemUnit) => {
    update(r.key, { ...priced(r, unit, currency), ...(!r.period && { periodKind: BASIS[unit].period }) });
    if (unit === "milestone") setLayout("consultancy");
  };

  /** Text in a line's service box: a catalogue label links the service; a course title fills its fee; anything else is the description. */
  const typeLine = (r: Row, text: string) => {
    const service = services.find((s) => !s.archivedAt && CatalogueContract.label(s) === text);
    if (service) {
      const unit = service.defaultUnit ?? (service.units.includes(r.unit as ItemUnit) ? (r.unit as ItemUnit) : service.units[0]);
      const linked = { ...r, serviceId: service.id };
      return update(r.key, {
        serviceId: service.id,
        description: service.name,
        detail: r.detail || service.description,
        ...priced(linked, unit, currency),
        ...(!r.period && { periodKind: BASIS[unit].period }),
      });
    }
    const course = courses.find((c) => c.title === text);
    // A course fee is a whole-course price, so billed as a fixed fee; only in the document's currency and into an empty price.
    if (course?.priceMinor && course.currency === currency && !r.unitPrice && !r.serviceId) {
      return update(r.key, { description: text, unit: "fee", quantity: "1", unitPrice: InvoiceMath.majorInput(course.priceMinor), periodKind: periodKind(r.period, "fee") });
    }
    update(r.key, { description: text });
  };

  const pickAgreement = (r: Row, agreement: Agreement | null) => {
    if (!agreement) return update(r.key, priced(r, r.unit as ItemUnit, currency));
    update(r.key, {
      unit: agreement.unit,
      ...(BASIS[agreement.unit].quantity === null && { quantity: "1" }),
      unitPrice: InvoiceMath.majorInput(agreement.rateMinor),
      pricingSource: "agreement",
      agreementId: agreement.id,
    });
    if (agreement.paymentTerms && !termsTouched && (isInvoice || isQuote)) setTerms({ terms: agreement.paymentTerms, days: agreement.termsDays });
  };

  /** A new currency re-prices catalogue and agreement lines (a rate in another currency is never kept); typed prices stay. */
  const pickCurrency = (cur: Currency) => {
    setCurrency(cur);
    setRows((list) => list.map((r) => (r.pricingSource === "manual" ? r : { ...r, ...priced(r, r.unit as ItemUnit, cur) })));
  };

  // An invoice with day-count terms is re-dated from its issue date when issued; this
  // shows the date it would get today. Only "Due by date" keeps a typed date.
  const datedOnIssue = isInvoice && paymentTerms !== "date";
  const dueOnIssue = InvoiceContract.dueDate(paymentTerms, today, Number(termsDays) || 0);
  // Legacy terms stay selectable on documents that already use them.
  const termOptions = InvoiceContract.OFFERED_TERMS.filter((t) => !(isQuote && t === "date"));
  if (!termOptions.includes(paymentTerms)) termOptions.push(paymentTerms);
  const bank = banks.find((b) => b.id === bankAccountId);
  const activeServices = services.filter((s) => !s.archivedAt);

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
      setRows(InvoiceContract.planItems(saved).map((item) => toRow(item)));
    } else {
      // Another client's agreement never carries over.
      setRows((list) => list.map((r) => (r.pricingSource === "agreement" ? { ...r, ...priced(r, r.unit as ItemUnit, currency) } : r)));
    }
    if (!termsTouched && (isInvoice || isQuote)) setTerms(InvoiceContract.resolveTerms(null, saved ?? null, { terms: settings.terms.default, days: settings.terms.days }));
    setClient(
      saved
        ? { clientId, clientName: saved.name, clientEmail: saved.email, clientPhone: saved.phone, clientAddress: saved.address }
        : { ...client, clientId: "" },
    );
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
      supersedesId: null,
      supersedesNumber: null,
      acceptance: null,
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
    if ((intent === "issue" || intent === "send" || intent === "issue-paid") && !window.confirm(issuePrompt(label))) return;
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
        <input type="hidden" name="items" value={JSON.stringify(rows.map(toDraft))} />
        <ol className="mt-2 grid gap-4">
          {rows.map((r, index) => {
            const service = serviceOf(r);
            return (
              <LineEditor
                key={r.key}
                row={r}
                index={index}
                docType={docType}
                layout={layout}
                currency={currency}
                service={service}
                services={activeServices}
                courses={courses.map((c) => c.title)}
                agreements={service && client.clientId ? LinePricing.agreementsFor(agreements, client.clientId, service.id, lineDate(r)) : []}
                amount={money(amounts[index])}
                canRemove={rows.length > 1}
                onChange={(patch) => update(r.key, patch)}
                onText={(text) => typeLine(r, text)}
                onUnit={(unit) => pickUnit(r, unit)}
                onAgreement={(agreement) => pickAgreement(r, agreement)}
                onRemove={() => setRows((list) => list.filter((x) => x.key !== r.key))}
              />
            );
          })}
        </ol>
        {errors.items && (
          <p role="alert" className="mt-2 text-xs text-gold">
            {errors.items}
          </p>
        )}
        <button type="button" disabled={rows.length >= InvoiceContract.LIMITS.items} onClick={() => setRows((list) => [...list, toRow()])} className="mt-3 text-sm text-quant hover:underline disabled:opacity-40">
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
        <legend className="mb-4 text-sm text-quant">Totals and terms</legend>
        <Field label="Currency" error={errors.currency} hint="Catalogue and agreement prices follow it">
          <select name="currency" value={currency} onChange={(e) => pickCurrency(e.target.value as Currency)} className={FIELD}>
            {InvoiceContract.CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {isInvoice || isQuote ? (
          <Field label={isQuote ? "Proposed payment terms" : "Payment terms"} error={errors.paymentTerms} hint={isQuote ? "Copied to the invoice" : "Counted from the issue date"}>
            <div className="mt-1 flex gap-2">
              <select
                name="paymentTerms"
                value={paymentTerms}
                onChange={(e) => {
                  setPaymentTerms(e.target.value as PaymentTerms);
                  setTermsTouched(true);
                }}
                className={`${FIELD} mt-0`}
              >
                {termOptions.map((value) => (
                  <option key={value} value={value}>
                    {InvoiceContract.PAYMENT_TERMS[value]}
                  </option>
                ))}
              </select>
              {paymentTerms === "custom" && (
                <input
                  name="termsDays"
                  aria-label="Days to pay"
                  inputMode="numeric"
                  required
                  placeholder="days"
                  value={termsDays}
                  onChange={(e) => {
                    setTermsDays(e.target.value);
                    setTermsTouched(true);
                  }}
                  className={`${FIELD} mt-0 w-20`}
                />
              )}
            </div>
          </Field>
        ) : (
          <>
            <input type="hidden" name="paymentTerms" value={paymentTerms} />
            {paymentTerms === "custom" && <input type="hidden" name="termsDays" value={termsDays} />}
          </>
        )}
        {datedOnIssue ? (
          <Field label="Due date" error={errors.dueDate} hint="Set when issued: issue date + terms">
            <input name="dueDate" type="hidden" value={dueOnIssue} />
            <p className="mt-1 py-2 text-sm text-ink">{InvoiceEmails.day(dueOnIssue)} if issued today</p>
          </Field>
        ) : (
          <Field label={isQuote ? "Valid until" : isCredit ? "Credit date" : "Due date"} error={errors.dueDate}>
            <input name="dueDate" type="date" required min={isCredit ? undefined : today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-invalid={errors.dueDate ? true : undefined} className={FIELD} />
          </Field>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-end rounded-md border border-line p-3 font-mono text-sm tabular-nums sm:col-start-3">
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
      </fieldset>

      {/* Infrequent fields: closed by default, still submitted. */}
      <details className="rounded-lg border border-line p-5" open={Boolean(errors.discountMinor || errors.taxRateBp || errors.bankAccountId || errors.paymentLink || errors.notes || errors.paymentInstructions)}>
        <summary className="cursor-pointer text-sm text-quant">More options: discount{vatOn ? ", VAT" : ""}{isInvoice ? ", bank, payment link, recurring" : ""}, notes</summary>
        <fieldset disabled={pending} className="mt-5 grid gap-5 sm:grid-cols-2">
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
              <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
                <input type="checkbox" name="recurring" defaultChecked={initial.recurring} className="accent-quant" />
                Repeats monthly (offered under “Create this month’s drafts”)
              </label>
            </>
          )}
          <Field label="Notes" error={errors.notes} hint="Optional. The terms come from Settings." className="sm:col-span-2">
            <textarea name="notes" rows={3} maxLength={2000} defaultValue={initial.notes} className={`${FIELD} resize-y`} />
          </Field>
        </fieldset>
      </details>

      {warnings && (warnings.duplicates.length > 0 || warnings.deviations.length > 0) && (
        <fieldset disabled={pending} className="grid gap-4 rounded-lg border border-gold/50 bg-gold/5 p-5 text-sm">
          <legend className="px-1 text-gold">Check before issuing</legend>
          {warnings.duplicates.length > 0 && (
            <div>
              <p>Already invoiced to this client for the same service and period:</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {warnings.duplicates.map((d) => (
                  <li key={`${d.number}-${d.code}-${d.period}`}>
                    {d.number}: {d.code} · {InvoiceEmails.period(d.period)}
                  </li>
                ))}
              </ul>
              <label className="mt-2 block text-xs text-muted">
                Reason to bill it again (needed to issue)
                <input name="duplicateReason" maxLength={200} placeholder="e.g. Extra sessions agreed on 12 Oct" className={`${FIELD} mt-1`} />
              </label>
            </div>
          )}
          {warnings.deviations.length > 0 && (
            <div>
              <p>Differs from accepted quote {warnings.quoteNumber}: these changes were not approved by the client.</p>
              <ul className="mt-1 list-disc pl-5 text-muted">
                {warnings.deviations.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
              <label className="mt-2 flex items-center gap-2">
                <input type="checkbox" name="confirmDeviations" className="accent-quant" />
                Issue with these changes (they are recorded in the history)
              </label>
            </div>
          )}
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        <button type="button" onClick={openPreview} disabled={pending} className="h-10 rounded-md border border-quant/50 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/10 disabled:opacity-60">
          Preview {label}
        </button>
        <button type="submit" name="intent" value="save" disabled={pending} className="h-10 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant transition-colors hover:bg-quant/25 disabled:opacity-60">
          {saving ? "Saving…" : "Save draft"}
        </button>
        {issueButtons}
        {isInvoice && (
          <button type="button" onClick={() => setPaying(!paying)} disabled={pending} aria-expanded={paying} className="h-10 rounded-md border border-emerald-400/40 px-4 text-sm text-emerald-300 transition-colors hover:bg-emerald-400/10 disabled:opacity-60">
            Issue &amp; record payment…
          </button>
        )}
        {message && (
          <p role="alert" className="text-sm text-gold">
            {message}
          </p>
        )}
      </div>
      {isInvoice && paying && (
        <fieldset disabled={pending} className="grid items-end gap-3 rounded-lg border border-emerald-400/30 p-5 sm:grid-cols-4">
          <legend className="px-1 text-sm text-emerald-300">Paid now: issue it with the payment received</legend>
          <input type="hidden" name="submissionKey" value={submissionKey} />
          <label className="text-xs text-muted">
            Amount ({currency})
            <input name="amount" inputMode="decimal" required defaultValue={InvoiceMath.majorInput(totals.totalMinor)} key={totals.totalMinor} className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Received on
            <input name="paidOn" type="date" required defaultValue={today} max={today} className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Method
            <select name="method" defaultValue="cash" className={`${FIELD} mt-1`}>
              {Object.entries(InvoiceContract.PAYMENT_METHODS).map(([value, name]) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted">
            Reference (optional)
            <input name="reference" maxLength={80} className={`${FIELD} mt-1`} />
          </label>
          <button type="submit" name="intent" value="issue-paid" className="h-10 rounded-md bg-emerald-400/15 px-4 text-sm font-medium text-emerald-300 hover:bg-emerald-400/25 sm:col-span-4 sm:justify-self-start">
            Issue and record payment
          </button>
          <p className="text-xs text-muted sm:col-span-4">The invoice shows as paid only once this payment covers it. A receipt is issued for the payment.</p>
        </fieldset>
      )}

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
