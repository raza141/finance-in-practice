import { describe, expect, it } from "vitest";

import { SettingsContract } from "@/domains/settings/services/SettingsContract";

import type { Invoice, LedgerEntry } from "../types";
import { DocumentAccess } from "./DocumentAccess";
import { DocumentFormat } from "./DocumentFormat";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceEmails } from "./InvoiceEmails";
import { InvoiceMath } from "./InvoiceMath";
import { Ledger } from "./Ledger";

const SETTINGS = SettingsContract.DEFAULTS;
const DAY = 86_400_000;
const doc = (fields: Partial<Invoice>) =>
  ({
    docType: "invoice",
    status: "sent",
    trn: "",
    taxRateBp: 0,
    dueDate: "2026-10-13",
    paidMinor: 0,
    creditedMinor: 0,
    totalMinor: 400000,
    currency: "AED",
    clientName: "Khawla Abdullah",
    clientPhone: "",
    number: "FIP-INV-2026-0002",
    paymentLink: "",
    receiptPayment: null,
    sentAt: new Date("2026-10-06T08:00:00Z"),
    paidAt: null,
    voidedAt: null,
    linkValidUntil: null,
    ...fields,
  }) as Invoice;

describe("DocumentAccess", () => {
  const issued = new Date("2026-01-01T00:00:00Z");
  it("keeps an unpaid invoice's link open", () => {
    expect(DocumentAccess.expiresAt(doc({ sentAt: issued }))).toBeNull();
  });
  it("expires 30 days after payment, never before 90 days from issue", () => {
    const early = doc({ sentAt: issued, status: "paid", paidAt: new Date(issued.getTime() + 5 * DAY) });
    expect(DocumentAccess.expiresAt(early)?.getTime()).toBe(issued.getTime() + 90 * DAY);
    const late = doc({ sentAt: issued, status: "paid", paidAt: new Date(issued.getTime() + 100 * DAY) });
    expect(DocumentAccess.expiresAt(late)?.getTime()).toBe(issued.getTime() + 130 * DAY);
    expect(DocumentAccess.isExpired(early, new Date(issued.getTime() + 91 * DAY))).toBe(true);
  });
  it("extends when the link is renewed", () => {
    const renewed = new Date(issued.getTime() + 200 * DAY);
    expect(DocumentAccess.expiresAt(doc({ sentAt: issued, status: "paid", paidAt: issued, linkValidUntil: renewed }))?.getTime()).toBe(renewed.getTime());
  });
});

describe("Ledger", () => {
  const entries: LedgerEntry[] = [
    { date: "2026-09-01", kind: "invoice", documentId: "a", number: "INV-1", currency: "AED", debitMinor: 400000, creditMinor: 0 },
    { date: "2026-09-28", kind: "payment", documentId: "a", number: "INV-1", currency: "AED", debitMinor: 0, creditMinor: 150000 },
    { date: "2026-10-01", kind: "invoice", documentId: "b", number: "INV-2", currency: "AED", debitMinor: 400000, creditMinor: 0 },
    { date: "2026-10-06", kind: "payment", documentId: "a", number: "INV-1", currency: "AED", debitMinor: 0, creditMinor: 250000 },
    { date: "2026-10-07", kind: "invoice", documentId: "c", number: "INV-3", currency: "USD", debitMinor: 10000, creditMinor: 0 },
  ];
  it("runs a balance per currency", () => {
    expect(Ledger.running(entries).map((row) => row.balanceMinor)).toEqual([400000, 250000, 650000, 400000, 10000]);
  });
  it("builds a month's statement with opening and closing balances", () => {
    const [aed, usd] = Ledger.statement(entries, "2026-10");
    expect(aed).toMatchObject({ currency: "AED", openingMinor: 250000, closingMinor: 400000 });
    expect(aed.rows).toHaveLength(2);
    expect(usd).toMatchObject({ currency: "USD", openingMinor: 0, closingMinor: 10000 });
    expect(Ledger.statement(entries, "2026-11").map((s) => [s.currency, s.closingMinor])).toEqual([
      ["AED", 400000],
      ["USD", 10000],
    ]);
  });
});

describe("terms, periods and new document fields", () => {
  it("derives due dates from payment terms", () => {
    expect(InvoiceContract.dueDate("net7", "2026-10-06")).toBe("2026-10-13");
    expect(InvoiceContract.dueDate("net14", "2026-12-25")).toBe("2027-01-08");
    expect(InvoiceContract.dueDate("on_receipt", "2026-10-06")).toBe("2026-10-06");
    expect(InvoiceContract.dueDate("net30", "2026-10-06")).toBe("2026-11-05");
    expect(InvoiceContract.dueDate("custom", "2026-10-06", 21)).toBe("2026-10-27");
  });
  it("counts days only for day-count terms, and prints custom terms as Net N", () => {
    expect(InvoiceContract.termDays("date")).toBeNull();
    expect(InvoiceContract.termDays("custom", 0)).toBe(0);
    expect(InvoiceContract.termDays("monthly")).toBe(7);
    expect(InvoiceContract.termsLabel("custom", 21)).toBe("Net 21 days");
    expect(InvoiceContract.termsLabel("custom", 0)).toBe("Due on receipt");
    expect(InvoiceContract.termsLabel("net14", null)).toBe("Net 14 days");
    expect(InvoiceContract.OFFERED_TERMS).not.toContain("monthly");
  });
  it("moves a period on by a month", () => {
    expect(InvoiceMath.nextPeriod("2026-12")).toBe("2027-01");
    expect(InvoiceMath.nextPeriod("2026-01-31")).toBe("2026-02-28");
    expect(InvoiceMath.nextPeriod("October 2026")).toBe("November 2026");
  });

  const fields = (overrides: Record<string, string> = {}) => ({
    clientName: "Sara",
    clientEmail: "",
    currency: "AED",
    items: JSON.stringify([{ description: "Phase 1", detail: "", period: "2026-10-20", unit: "milestone", quantity: "1", unitPrice: "5000" }]),
    dueDate: "2026-10-20",
    ...overrides,
  });
  it("keeps milestones to the consultancy layout, and reads its sections", () => {
    const standard = InvoiceContract.parseInvoice(fields());
    expect(standard.ok ? null : standard.errors.items).toContain("consultancy");
    const consultancy = InvoiceContract.parseInvoice(fields({ layout: "consultancy", "section.scope": " Valuation model ", paymentTerms: "after_delivery", docType: "quote" }));
    expect(consultancy.ok && consultancy.input).toMatchObject({ docType: "quote", layout: "consultancy", paymentTerms: "after_delivery", sections: { scope: "Valuation model" } });
  });
  it("accepts only https payment links", () => {
    const bad = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentLink: "http://pay.example" }));
    expect(bad.ok ? null : bad.errors.paymentLink).toBeTruthy();
    const good = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentLink: "https://pay.example/x" }));
    expect(good.ok && good.input.paymentLink).toBe("https://pay.example/x");
  });
  it("needs a day count for custom terms, and keeps explicit dates off quotes", () => {
    const custom = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentTerms: "custom", termsDays: "21" }));
    expect(custom.ok && custom.input).toMatchObject({ paymentTerms: "custom", termsDays: 21 });
    for (const termsDays of ["", "-1", "366", "2.5"]) {
      const bad = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentTerms: "custom", termsDays }));
      expect(bad.ok ? null : bad.errors.paymentTerms).toBeTruthy();
    }
    const net = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentTerms: "net30", termsDays: "9" }));
    expect(net.ok && net.input.termsDays).toBeNull();
    const credit = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentTerms: "custom", termsDays: "21", docType: "credit_note" }));
    expect(credit.ok && credit.input.termsDays).toBe(21);
    const quote = InvoiceContract.parseInvoice(fields({ layout: "consultancy", paymentTerms: "date", docType: "quote" }));
    expect(quote.ok ? null : quote.errors.paymentTerms).toBeTruthy();
  });
  it("reads a payment's submission key, refusing anything but a UUID", () => {
    const base = { amount: "450", paidOn: "2026-10-06" };
    const key = "6f1c2a4e-1b2c-4d3e-8f90-123456789abc";
    expect(InvoiceContract.parsePayment({ ...base, submissionKey: key })).toMatchObject({ submissionKey: key });
    expect(InvoiceContract.parsePayment(base)).toMatchObject({ submissionKey: null });
    expect(typeof InvoiceContract.parsePayment({ ...base, submissionKey: "x' OR 1=1" })).toBe("string");
  });
  it("parses a Quick Receipt", () => {
    const parsed = InvoiceContract.parseQuickReceipt({ clientName: "Ali", service: "CFA session", amount: "450", paidOn: "2026-10-06", method: "cash", currency: "AED" });
    expect(parsed.ok && parsed.input).toMatchObject({ service: "CFA session", payment: { amountMinor: 45000, method: "cash" } });
    expect(InvoiceContract.parseQuickReceipt({ clientName: "", service: "", amount: "x", paidOn: "", currency: "AED" }).ok).toBe(false);
  });
});

describe("messages from Settings templates", () => {
  it("fills placeholders and keeps unknown ones", () => {
    expect(SettingsContract.fill("Hi {firstName}, {nope}", { firstName: "Sara" })).toBe("Hi Sara, {nope}");
  });
  it("adds the balance and the pay-online line before the sign-off", () => {
    const settings = { ...SETTINGS, card: { show: true, note: "" } };
    const text = InvoiceEmails.whatsappText(doc({ paidMinor: 150000, paymentLink: "https://pay.example/x" }), "https://fip/invoice/t", settings);
    expect(text).toContain("Balance due: AED 2,500.00.");
    expect(text).toContain("Pay online: https://pay.example/x");
    expect(text.indexOf("Pay online")).toBeLessThan(text.indexOf("Thank you,"));
    expect(InvoiceEmails.whatsappText(doc({ paymentLink: "https://pay.example/x" }), "u", SETTINGS)).not.toContain("Pay online");
  });
  it("words a receipt email as received, with the receipt's own amount", () => {
    const receipt = doc({
      docType: "receipt",
      status: "paid",
      number: "FIP-REC-2026-0001",
      totalMinor: 150000,
      receiptPayment: { id: "p", amountMinor: 150000, paidOn: "2026-10-06", note: "", method: "cash", reference: "", proofUrl: null, receiptId: "r" },
    });
    const message = InvoiceEmails.document(receipt, "https://fip/invoice/t", SETTINGS);
    expect(message.subject).toBe("Receipt FIP-REC-2026-0001 from Finance in Practice");
    expect(message.text).toContain("Amount received: AED 1,500.00");
    expect(message.text).not.toContain("Payment details");
  });
});

describe("DocumentFormat", () => {
  it("titles tax documents only when issued with a TRN and VAT", () => {
    expect(DocumentFormat.title(doc({}))).toBe("Invoice");
    expect(DocumentFormat.title(doc({ trn: "100123456789003", taxRateBp: 500 }))).toBe("Tax invoice");
    expect(DocumentFormat.title(doc({ docType: "credit_note", trn: "100123456789003", taxRateBp: 500 }))).toBe("Tax credit note");
    expect(DocumentFormat.title(doc({ docType: "quote", trn: "100123456789003", taxRateBp: 500 }))).toBe("Quote");
  });
  it("names the PDF Type-Number-Client and stamps expired quotes", () => {
    expect(DocumentFormat.filename(doc({ docType: "credit_note", number: "FIP-CN-2026-0001", clientName: " Khawla  Abdullah " }))).toBe("Credit-note-FIP-CN-2026-0001-Khawla-Abdullah");
    expect(DocumentFormat.stamp(doc({ docType: "quote", dueDate: "2026-10-01" }), "2026-10-06")).toBe("expired");
    expect(DocumentFormat.balance(doc({ paidMinor: 100000, creditedMinor: 50000 }))).toBe(250000);
    // A paid invoice can still be credited, up to what hasn't been credited yet.
    expect(DocumentFormat.creditable(doc({ status: "paid", paidMinor: 400000, creditedMinor: 50000 }))).toBe(350000);
    expect(DocumentFormat.balance(doc({ status: "paid", paidMinor: 400000, creditedMinor: 50000 }))).toBe(0);
  });
  it("prints unit words from Settings, legacy units as issued", () => {
    expect(SettingsContract.unitLabel(SETTINGS, "session", 2)).toBe("sessions");
    expect(SettingsContract.unitLabel(SETTINGS, "fee", 2)).toBe("fee");
    expect(SettingsContract.unitLabel(SETTINGS, "contract", 1)).toBe("contract");
  });
});
