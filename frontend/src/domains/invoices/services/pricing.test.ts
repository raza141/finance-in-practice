import { describe, expect, it } from "vitest";

import type { Service } from "@/domains/catalogue/types";

import type { Agreement, Invoice, InvoiceItem } from "../types";
import { InvoiceContract } from "./InvoiceContract";
import { InvoiceEmails } from "./InvoiceEmails";
import { LinePricing } from "./LinePricing";
import { QuoteDiff } from "./QuoteDiff";

const SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const AGREEMENT_ID = "22222222-2222-4222-8222-222222222222";
const CLIENT_ID = "33333333-3333-4333-8333-333333333333";

const service: Service = {
  id: SERVICE_ID,
  code: "CF001",
  name: "CFA Level I tutoring",
  description: "",
  category: "CFA",
  units: ["month", "hour"],
  defaultUnit: "month",
  archivedAt: null,
  prices: [
    { id: "p1", unit: "month", currency: "AED", rateMinor: 150_000, effectiveFrom: "2026-01-01", effectiveTo: null },
    { id: "p2", unit: "hour", currency: "AED", rateMinor: 45_000, effectiveFrom: "2026-01-01", effectiveTo: "2026-09-30" },
    { id: "p3", unit: "hour", currency: "AED", rateMinor: 50_000, effectiveFrom: "2026-10-01", effectiveTo: null },
  ],
};

const agreement: Agreement = {
  id: AGREEMENT_ID,
  clientId: CLIENT_ID,
  serviceId: SERVICE_ID,
  serviceCode: "CF001",
  serviceName: "CFA Level I tutoring",
  unit: "month",
  currency: "AED",
  rateMinor: 120_000,
  startsOn: "2026-09-01",
  endsOn: null,
  paymentTerms: "net14",
  termsDays: null,
  schedule: "",
  scope: "",
  archivedAt: null,
};

const line = (fields: Partial<InvoiceItem>): InvoiceItem => ({ description: "CFA Level I tutoring", unit: "month", quantity: 1, unitMinor: 150_000, amountMinor: 150_000, ...fields });
const context = { clientId: CLIENT_ID, currency: "AED" as const, today: "2026-11-05" };

describe("service periods", () => {
  it("accepts a month, a day, a range or text, and requires one on invoices", () => {
    for (const ok of ["2026-10", "2026-10-09", "2026-10-01/2026-11-30", "Weekends in October"]) expect(InvoiceContract.periodProblem(ok, "invoice")).toBeNull();
    expect(InvoiceContract.periodProblem("2026-11-30/2026-10-01", "invoice")).toBeTruthy();
    expect(InvoiceContract.periodProblem("2026-13", "invoice")).toBeTruthy();
    expect(InvoiceContract.periodProblem("", "invoice")).toBeTruthy();
    expect(InvoiceContract.periodProblem("To be agreed", "invoice")).toBeTruthy();
    expect(InvoiceContract.periodProblem("To be agreed", "quote")).toBeNull();
    expect(InvoiceContract.periodProblem("", "quote")).toBeNull();
  });
  it("prints periods as months, days and ranges, never from the issue date", () => {
    expect(InvoiceEmails.period("2026-10")).toBe("October 2026");
    expect(InvoiceEmails.period("2026-10-01/2026-11-30")).toBe("1 October–30 November 2026");
    expect(InvoiceEmails.period("2026-10-01/2026-10-15")).toBe("1–15 October 2026");
    expect(InvoiceEmails.period("2026-12-01/2027-01-31")).toBe("1 December 2026–31 January 2027");
    expect(LinePricing.periodStart("2026-10")).toBe("2026-10-01");
    expect(LinePricing.periodStart("2026-10-01/2026-11-30")).toBe("2026-10-01");
    expect(LinePricing.periodStart("To be agreed")).toBeNull();
  });
  it("bills fixed fees and milestones once", () => {
    const items = JSON.stringify([{ description: "Valuation project", period: "2026-10-01/2026-11-30", unit: "fee", quantity: "2", unitPrice: "5000" }]);
    const parsed = InvoiceContract.parseInvoice({ clientName: "Co", currency: "AED", items, dueDate: "2026-11-01" });
    expect(parsed.ok ? null : parsed.errors.items).toContain("quantity 1");
  });
});

describe("LinePricing", () => {
  it("offers a client's agreements for the service on the date, and never another client's", () => {
    expect(LinePricing.agreementsFor([agreement], CLIENT_ID, SERVICE_ID, "2026-10-01")).toHaveLength(1);
    expect(LinePricing.agreementsFor([agreement], CLIENT_ID, SERVICE_ID, "2026-08-31")).toHaveLength(0);
    expect(LinePricing.agreementsFor([agreement], null, SERVICE_ID, "2026-10-01")).toHaveLength(0);
    expect(LinePricing.agreementsFor([{ ...agreement, archivedAt: new Date() }], CLIENT_ID, SERVICE_ID, "2026-10-01")).toHaveLength(0);
  });
  it("prices from the catalogue by the line's own period, never by today", () => {
    // October work invoiced in November: October's hourly rate.
    expect(LinePricing.cataloguePrice(service, "hour", "AED", LinePricing.periodStart("2026-09")!)?.rateMinor).toBe(45_000);
    expect(LinePricing.cataloguePrice(service, "hour", "USD", "2026-10-01")).toBeNull();
    expect(LinePricing.cataloguePrice(service, "session", "AED", "2026-10-01")).toBeNull();
  });
  it("keeps a price source only when it is true, and copies the code", () => {
    const items = [
      line({ serviceId: SERVICE_ID, period: "2026-10", pricingSource: "catalogue" }),
      line({ serviceId: SERVICE_ID, period: "2026-10", pricingSource: "catalogue", unitMinor: 99_900, amountMinor: 99_900 }),
      line({ serviceId: SERVICE_ID, period: "2026-10", pricingSource: "agreement", agreementId: AGREEMENT_ID, unitMinor: 120_000, amountMinor: 120_000 }),
      line({ serviceId: SERVICE_ID, period: "2026-10", pricingSource: "agreement", agreementId: AGREEMENT_ID, unit: "hour", unitMinor: 120_000, amountMinor: 120_000 }),
      line({ description: "One-off review", pricingSource: "catalogue", code: "FAKE" }),
    ];
    const verified = LinePricing.verify(items, [service], [agreement], context);
    expect(Array.isArray(verified) && verified.map((i) => [i.code, i.pricingSource, i.agreementId])).toEqual([
      ["CF001", "catalogue", undefined],
      ["CF001", "manual", undefined],
      ["CF001", "agreement", AGREEMENT_ID],
      ["CF001", "manual", undefined],
      [undefined, "manual", undefined],
    ]);
    // Another client's agreement is never honoured.
    const other = LinePricing.verify([items[2]], [service], [agreement], { ...context, clientId: null });
    expect(Array.isArray(other) && other[0].pricingSource).toBe("manual");
  });
  it("refuses an unknown service or a basis it doesn't offer", () => {
    expect(typeof LinePricing.verify([line({ serviceId: SERVICE_ID, unit: "session" })], [service], [], context)).toBe("string");
    expect(typeof LinePricing.verify([line({ serviceId: AGREEMENT_ID })], [service], [], context)).toBe("string");
  });
});

describe("terms priority and agreements", () => {
  const fallback = { terms: "net7" as const, days: null };
  it("takes the agreement's terms, then the client's, then the business default", () => {
    expect(InvoiceContract.resolveTerms(agreement, { paymentTerms: "net30", termsDays: null }, fallback)).toEqual({ terms: "net14", days: null });
    expect(InvoiceContract.resolveTerms({ paymentTerms: null, termsDays: null }, { paymentTerms: "custom", termsDays: 21 }, fallback)).toEqual({ terms: "custom", days: 21 });
    expect(InvoiceContract.resolveTerms(null, null, fallback)).toEqual(fallback);
  });
  it("parses an agreement: a rate above 0, dates in order, day-count terms only", () => {
    const fields = { serviceId: SERVICE_ID, unit: "month", currency: "AED", rate: "1,200", startsOn: "2026-09-01", paymentTerms: "custom", termsDays: "10" };
    expect(InvoiceContract.parseAgreement(fields)).toMatchObject({ ok: true, input: { rateMinor: 120_000, endsOn: null, paymentTerms: "custom", termsDays: 10 } });
    expect(InvoiceContract.parseAgreement({ ...fields, rate: "" })).toMatchObject({ ok: false, errors: { rateMinor: expect.any(String) } });
    expect(InvoiceContract.parseAgreement({ ...fields, endsOn: "2026-08-01" })).toMatchObject({ ok: false, errors: { endsOn: expect.any(String) } });
    expect(InvoiceContract.parseAgreement({ ...fields, paymentTerms: "date" })).toMatchObject({ ok: false, errors: { paymentTerms: expect.any(String) } });
  });
});

describe("quote acceptance", () => {
  const now = new Date("2026-10-09T12:00:00Z");
  const fields = { acceptedAt: "2026-10-09T10:30", approver: "Sara Khan", method: "whatsapp", evidenceUrl: "https://drive.example/approval.png" };
  it("reads the acceptance in Dubai time with an https evidence link", () => {
    const parsed = InvoiceContract.parseAcceptance(fields, now);
    expect(parsed.ok && parsed.input.acceptedAt.toISOString()).toBe("2026-10-09T06:30:00.000Z");
    expect(parsed.ok && parsed.input.evidenceUrl).toBe("https://drive.example/approval.png");
  });
  it("refuses future dates, unknown methods and non-https links", () => {
    for (const bad of [{ acceptedAt: "2026-10-10T10:00" }, { method: "fax" }, { approver: "" }, { evidenceUrl: "javascript:alert(1)" }, { evidenceUrl: "http://x.test" }]) {
      expect(InvoiceContract.parseAcceptance({ ...fields, ...bad }, now).ok).toBe(false);
    }
  });
});

describe("QuoteDiff", () => {
  const quote = {
    items: [line({ description: "Valuation project", unit: "fee", unitMinor: 500_000, amountMinor: 500_000, period: "To be agreed" })],
    currency: "AED" as const,
    discountMinor: 0,
    paymentTerms: "net14" as const,
    termsDays: null,
  } satisfies Partial<Invoice>;
  it("finds nothing when only the period was confirmed", () => {
    expect(QuoteDiff.changes(quote, { ...quote, items: [{ ...quote.items[0], period: "2026-10-01/2026-11-30", sourceLine: 0 }] })).toEqual([]);
  });
  it("lists changed prices, added lines and changed terms", () => {
    const invoice = {
      ...quote,
      paymentTerms: "net30" as const,
      items: [
        { ...quote.items[0], unitMinor: 550_000, amountMinor: 550_000, sourceLine: 0 },
        line({ description: "Extra workshop", unit: "hour", unitMinor: 50_000, amountMinor: 50_000 }),
      ],
    };
    const changes = QuoteDiff.changes(quote, invoice);
    expect(changes).toHaveLength(3);
    expect(changes.join(" | ")).toMatch(/price AED 5,000.00 → AED 5,500.00.*Extra workshop.*Terms Net 14 days → Net 30 days/);
    expect(QuoteDiff.changes(quote, { ...quote, items: [] })).toEqual(["Line “Valuation project” removed"]);
  });
});
