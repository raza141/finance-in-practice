import { describe, expect, it, vi } from "vitest";

import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";

import { SettingsContract } from "@/domains/settings/services/SettingsContract";

import type { Invoice } from "../types";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceEmails } from "./InvoiceEmails";
import { InvoiceMath } from "./InvoiceMath";

vi.mock("server-only", () => ({}));

const invoiceFields = (overrides: Record<string, string> = {}) => ({
  clientName: "  Sara Khan ",
  clientEmail: "Sara@Example.com",
  currency: "AED",
  items: JSON.stringify([
    { description: "CFA Level I session", detail: " 6-30 Oct ", period: " October 2026 ", unit: "hour", quantity: "1.5", unitPrice: "333.33" },
    { description: "Mock exam review", detail: "", unit: "fee", quantity: "2", unitPrice: "100" },
  ]),
  discount: "",
  taxRate: "",
  trn: "",
  dueDate: "2026-10-12",
  notes: "",
  paymentInstructions: "IBAN AE00 0000",
  ...overrides,
});

const SETTINGS = SettingsContract.DEFAULTS;
/** An issued invoice with no payments, for the message builders. */
const issued = (fields: Partial<Invoice>) =>
  ({ docType: "invoice", status: "sent", paidMinor: 0, creditedMinor: 0, paymentLink: "", receiptPayment: null, paymentInstructions: "", bank: null, ...fields }) as Invoice;

describe("InvoiceMath", () => {
  it("computes line amounts and totals in integer minor units, rounding half-up", () => {
    expect(InvoiceMath.lineAmount(1.5, 33_333)).toBe(50_000); // 499.995 -> 500.00
    expect(InvoiceMath.lineAmount(0.1, 5)).toBe(1); // 0.5 -> 1
    expect(InvoiceMath.totals([50_000, 20_000], 0, 0)).toEqual({ subtotalMinor: 70_000, discountMinor: 0, taxMinor: 0, totalMinor: 70_000 });
    // Discount comes off before tax: (700.00 - 50.10) * 5% = 32.495 -> 32.50
    expect(InvoiceMath.totals([50_000, 20_000], 5_010, 500)).toEqual({ subtotalMinor: 70_000, discountMinor: 5_010, taxMinor: 3_250, totalMinor: 68_240 });
  });

  it("formats invoice numbers and money", () => {
    expect(InvoiceMath.number("2026-10-05", 1)).toBe("FIP-2026-0001");
    expect(InvoiceMath.number("2027-01-02", 12_345)).toBe("FIP-2027-12345");
    expect(InvoiceMath.money(125_050, "AED")).toBe("AED 1,250.50");
    expect(InvoiceMath.parseMajor("4,500.5")).toBe(450_050);
    expect(InvoiceMath.parseMajor("1.234")).toBeNull();
  });
});

describe("InvoiceMath monthly copy", () => {
  it("adds months, clamping to the month's end", () => {
    expect(InvoiceMath.addMonths("2026-10-12", 1)).toBe("2026-11-12");
    expect(InvoiceMath.addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(InvoiceMath.addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(InvoiceMath.addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("moves month names on, keeping their style and rolling the year", () => {
    expect(InvoiceMath.nextMonthText("October cohort")).toBe("November cohort");
    expect(InvoiceMath.nextMonthText("8 sessions, 6-30 Oct")).toBe("8 sessions, 6-30 Nov");
    expect(InvoiceMath.nextMonthText("Dec 2026 tutoring")).toBe("Jan 2027 tutoring");
    expect(InvoiceMath.nextMonthText("December 2026")).toBe("January 2027");
    expect(InvoiceMath.nextMonthText("Sept-Oct")).toBe("Oct-Nov");
    expect(InvoiceMath.nextMonthText("CFA Level I: Octane, decimal")).toBe("CFA Level I: Octane, decimal");
  });
});

describe("InvoiceContract.parseInvoice", () => {
  it("validates, normalises and prices the items", () => {
    const parsed = InvoiceContract.parseInvoice(invoiceFields({ discount: "50.10", taxRate: "5" }));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.input.clientName).toBe("Sara Khan");
    expect(parsed.input.clientEmail).toBe("sara@example.com");
    expect(parsed.input.items.map((i) => i.amountMinor)).toEqual([50_000, 20_000]);
    expect(parsed.input.discountMinor).toBe(5_010);
    expect(parsed.input.taxRateBp).toBe(500);
    expect(parsed.input.bookingUid).toBeNull();
    expect(parsed.input.items[0]).toMatchObject({ detail: "6-30 Oct", period: "October 2026", unit: "hour" });
    expect(parsed.input.items[1]).not.toHaveProperty("detail");
    expect(parsed.input).toMatchObject({ clientId: null, bankAccountId: null, clientPhone: "", clientAddress: "" });
  });

  it("rejects bad input field by field", () => {
    const parsed = InvoiceContract.parseInvoice(
      invoiceFields({ clientEmail: "nope", currency: "BTC", taxRate: "120", dueDate: "2026-02-30", bookingUid: "../x" }),
    );
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(Object.keys(parsed.errors).sort()).toEqual(["bookingUid", "clientEmail", "currency", "dueDate", "taxRateBp"]);
    expect(InvoiceContract.parseInvoice(invoiceFields({ discount: "800" }))).toMatchObject({ ok: false, errors: { discountMinor: expect.any(String) } });
    expect(InvoiceContract.parseInvoice(invoiceFields({ items: "[]" }))).toMatchObject({ ok: false, errors: { items: "Add at least one line item." } });
    expect(InvoiceContract.parseInvoice(invoiceFields({ items: '[{"description":"x","unit":"hour","quantity":"0","unitPrice":"1"}]' }))).toMatchObject({
      ok: false,
      errors: { items: expect.stringContaining("Line 1") },
    });
    for (const unit of ["weekly", "toString", undefined]) {
      expect(InvoiceContract.parseInvoice(invoiceFields({ items: JSON.stringify([{ description: "x", unit, quantity: "1", unitPrice: "1" }]) }))).toMatchObject({
        ok: false,
        errors: { items: expect.stringContaining("how the line is billed") },
      });
    }
    expect(InvoiceContract.parseInvoice(invoiceFields({ clientId: "1; DROP", bankAccountId: "x" }))).toMatchObject({
      ok: false,
      errors: { clientId: expect.any(String), bankAccountId: expect.any(String) },
    });
  });
});

describe("InvoiceContract.parseClient / parseBank", () => {
  it("validates a saved client", () => {
    expect(InvoiceContract.parseClient({ name: " Sara ", email: "SARA@x.co", phone: "", address: "Dubai", planUnit: "", planFee: "", planCurrency: "AED" })).toEqual({
      ok: true,
      input: { name: "Sara", email: "sara@x.co", phone: "", address: "Dubai", courses: [], planUnit: null, planFeeMinor: null, planCurrency: "AED", planNotes: "" },
    });
    const withPlan = InvoiceContract.parseClient({
      name: "Sara",
      email: "sara@x.co",
      courses: [" CFA Level I ", "FRM Part I", "CFA Level I", ""],
      planUnit: "month",
      planFee: "1,500",
      planCurrency: "USD",
      planNotes: "Due on the 1st",
    });
    expect(withPlan).toMatchObject({ ok: true, input: { courses: ["CFA Level I", "FRM Part I"], planUnit: "month", planFeeMinor: 150_000, planCurrency: "USD" } });
    expect(InvoiceContract.parseClient({ name: "S", email: "s@x.co", planUnit: "weekly", planFee: "abc", planCurrency: "BTC" })).toMatchObject({
      ok: false,
      errors: { planUnit: expect.any(String), planFeeMinor: expect.any(String), planCurrency: expect.any(String) },
    });
    expect(InvoiceContract.parseClient({ name: "", email: "x" })).toMatchObject({ ok: false, errors: { name: expect.any(String), email: expect.any(String) } });
  });

  it("turns a client's courses and plan into invoice lines", () => {
    const client = { courses: ["CFA Level I", "FRM Part I"], planUnit: "month" as const, planFeeMinor: 150_000, planCurrency: "AED" as const };
    expect(InvoiceContract.planItems(client)).toEqual([
      { description: "CFA Level I", unit: "month", quantity: 1, unitMinor: 150_000, amountMinor: 150_000 },
      { description: "FRM Part I", unit: "month", quantity: 1, unitMinor: 150_000, amountMinor: 150_000 },
    ]);
    expect(InvoiceContract.planSummary(client)).toBe("AED 1,500.00 · Monthly");
    expect(InvoiceContract.planSummary({ planUnit: null, planFeeMinor: null, planCurrency: "AED" })).toBe("");
  });

  it("needs a bank name and an account number or IBAN", () => {
    const parsed = InvoiceContract.parseBank({ bankName: "Emirates NBD", iban: "ae07 0331", swift: "ebiliaead" });
    expect(parsed).toMatchObject({ ok: true, input: { bankName: "Emirates NBD", iban: "AE07 0331", swift: "EBILIAEAD", accountNumber: "" } });
    expect(InvoiceContract.parseBank({ bankName: "" })).toMatchObject({ ok: false, errors: { bankName: expect.any(String), accountNumber: expect.any(String) } });
  });
});

describe("InvoiceContract.parseConfirmation", () => {
  const fields = {
    clientName: "Omar",
    clientEmail: "omar@example.com",
    date: "2026-10-25",
    time: "09:30",
    clientTimeZone: "Europe/London",
    durationMinutes: "60",
    topic: "FRM Part I",
    location: "https://meet.google.com/abc-defg-hij",
    note: "",
  };

  it("converts the client's wall-clock time to an instant across DST changes", () => {
    // 25 Oct 2026: London is back on GMT (clocks went back at 01:00 UTC).
    expect(InvoiceContract.zonedInstant("2026-10-25", "09:30", "Europe/London").toISOString()).toBe("2026-10-25T09:30:00.000Z");
    expect(InvoiceContract.zonedInstant("2026-10-24", "09:30", "Europe/London").toISOString()).toBe("2026-10-24T08:30:00.000Z");
    expect(InvoiceContract.zonedInstant("2026-03-29", "03:00", "Europe/London").toISOString()).toBe("2026-03-29T02:00:00.000Z");
    expect(InvoiceContract.zonedInstant("2026-10-05", "00:15", "Asia/Dubai").toISOString()).toBe("2026-10-04T20:15:00.000Z");
    const parsed = InvoiceContract.parseConfirmation(fields);
    expect(parsed).toMatchObject({ ok: true, input: { start: "2026-10-25T09:30:00.000Z", durationMinutes: 60 } });
  });

  it("only accepts http(s) links", () => {
    expect(InvoiceContract.parseConfirmation({ ...fields, location: "javascript:alert(1)" })).toMatchObject({ ok: false, errors: { location: expect.any(String) } });
    expect(InvoiceContract.parseConfirmation({ ...fields, location: "Office, Business Bay" }).ok).toBe(true);
    expect(InvoiceContract.parseConfirmation({ ...fields, clientTimeZone: "Mars/Base", time: "25:00" })).toMatchObject({
      ok: false,
      errors: { clientTimeZone: expect.any(String), time: expect.any(String) },
    });
  });
});

describe("emails", () => {
  it("escapes user text and attribute values", () => {
    expect(EmailHtml.escape(`<b>"Tom" & 'Jerry'</b>`)).toBe("&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;");
    expect(EmailHtml.link('https://x.test/?a="><script>')).not.toContain("<script>");
    expect(EmailHtml.link("javascript:alert(1)")).not.toContain("<a");
  });

  it("builds a confirmation in the client's zone and Dubai time", () => {
    const message = InvoiceEmails.confirmation({
      bookingUid: null,
      clientName: "<img src=x onerror=alert(1)>",
      clientEmail: "a@b.co",
      start: "2026-10-06T10:00:00.000Z",
      durationMinutes: 45,
      clientTimeZone: "Asia/Karachi",
      topic: "CFA Level II",
      location: "https://zoom.us/j/1",
      note: "Bring\nyour notes",
    });
    expect(message.html).not.toContain("<img");
    expect(message.html).toContain("&lt;img");
    expect(message.html).toContain("Bring<br>your notes");
    expect(message.text).toContain("15:00"); // Karachi, UTC+5
    expect(message.text).toContain("14:00"); // Dubai, UTC+4
    expect(message.text).toContain("45 minutes");
    expect(message.subject).toContain("CFA Level II");
  });

  it("links the invoice email to the public page", () => {
    const invoice = issued({ number: "FIP-2026-0007", clientName: "Sara Khan", totalMinor: 68_240, currency: "AED", issueDate: "2026-10-05", dueDate: "2026-10-12", paymentInstructions: "IBAN" });
    const message = InvoiceEmails.document(invoice, "https://financeinpractice.me/invoice/tok", SETTINGS);
    expect(message.subject).toBe("Invoice FIP-2026-0007 from Finance in Practice");
    expect(message.html).toContain('href="https://financeinpractice.me/invoice/tok"');
    expect(message.text).toContain("AED 682.40");
    expect(message.text).toMatch(/^Hi Sara,/);
    expect(message.text).toContain("Invoice FIP-2026-0007 for AED 682.40 is ready.");
    expect(message.text).toContain("Thank you,\nAhmed Raza\n");
  });

  it("puts the bank details in the invoice email, skipping empty fields", () => {
    const bank = { bankName: "Emirates NBD", accountTitle: "M A Raza", accountNumber: "", iban: "AE07 0331", branch: "", swift: "" };
    const invoice = issued({ number: "FIP-2026-0008", clientName: "Sara", totalMinor: 100, currency: "AED", issueDate: "2026-10-05", dueDate: "2026-10-12", bank });
    const message = InvoiceEmails.document(invoice, "https://x.test/invoice/tok", SETTINGS);
    expect(message.text).toContain("IBAN: AE07 0331");
    expect(message.text).toContain("Reference: FIP-2026-0008");
    expect(message.text).not.toContain("Branch");
    expect(message.html).toContain("Emirates NBD");
  });
});

describe("ResendClient", () => {
  it("is disabled without configuration", () => {
    expect(ResendClient.fromEnv({ RESEND_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(ResendClient.fromEnv({ EMAIL_FROM: "a@b.co" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("posts to /emails and returns the message id", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const client = new ResendClient({ apiKey: "re_test", from: "FIP <b@fip.test>", replyTo: "me@fip.test" }, fetchImpl);
    await expect(client.send("c@x.test", { subject: "S", html: "<p>H</p>", text: "H" })).resolves.toBe("msg_1");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(init.body as string)).toEqual({ from: "FIP <b@fip.test>", to: ["c@x.test"], subject: "S", html: "<p>H</p>", text: "H", reply_to: "me@fip.test" });
  });

  it("surfaces Resend's error message", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ statusCode: 403, name: "validation_error", message: "Domain not verified" }), { status: 403 }));
    const client = new ResendClient({ apiKey: "k", from: "a@b.co", replyTo: null }, fetchImpl);
    await expect(client.send("c@x.test", { subject: "S", html: "", text: "" })).rejects.toThrow("Domain not verified");
  });
});

describe("InvoiceEmails.period", () => {
  it("formats picked months and dates, keeps typed text", () => {
    expect(InvoiceEmails.period("2026-10")).toBe("October 2026");
    expect(InvoiceEmails.period("2026-10-14")).toBe("14 Oct 2026");
    expect(InvoiceEmails.period("6–30 Oct")).toBe("6–30 Oct");
  });
});

describe("InvoiceEmails.whatsapp", () => {
  it("normalises UAE numbers and prefills the invoice link", () => {
    expect(InvoiceEmails.whatsappNumber("050 230 4045")).toBe("971502304045");
    expect(InvoiceEmails.whatsappNumber("+971 50 230 4045")).toBe("971502304045");
    expect(InvoiceEmails.whatsappNumber("0097150 230 4045")).toBe("971502304045");
    expect(InvoiceEmails.whatsappNumber("")).toBe("");
    const invoice = issued({ number: "FIP-2026-0007", clientName: "Sara Khan", clientPhone: "050 230 4045", totalMinor: 400000, currency: "AED", dueDate: "2026-10-13" });
    const href = InvoiceEmails.whatsapp(invoice, "https://financeinpractice.me/invoice/tok", SETTINGS);
    expect(href.startsWith("https://wa.me/971502304045?text=")).toBe(true);
    const text = decodeURIComponent(href.split("?text=")[1]);
    expect(text).toContain("Hi Sara, invoice FIP-2026-0007 for AED 4,000.00 is ready, due 13 Oct 2026.");
    expect(text).toContain("https://financeinpractice.me/invoice/tok");
    expect(InvoiceEmails.whatsapp({ ...invoice, clientPhone: "" }, "u", SETTINGS).startsWith("https://wa.me/?text=")).toBe(true);
  });
});

describe("InvoiceContract payments and optional email", () => {
  it("parses a payment and rejects a bad amount or date", () => {
    expect(InvoiceContract.parsePayment({ amount: "1,500", paidOn: "2026-10-06", note: " Advance " })).toEqual({ amountMinor: 150000, paidOn: "2026-10-06", note: "Advance", method: "bank", reference: "" });
    expect(typeof InvoiceContract.parsePayment({ amount: "0", paidOn: "2026-10-06" })).toBe("string");
    expect(typeof InvoiceContract.parsePayment({ amount: "100", paidOn: "06/10/2026" })).toBe("string");
  });

  it("accepts an invoice without a client email, but not a malformed one", () => {
    const fields = invoiceFields({ clientEmail: "" });
    const parsed = InvoiceContract.parseInvoice(fields);
    expect(parsed.ok && parsed.input.clientEmail).toBe("");
    const bad = InvoiceContract.parseInvoice({ ...fields, clientEmail: "not-an-email" });
    expect(bad.ok ? null : bad.errors.clientEmail).toBeTruthy();
  });
});
