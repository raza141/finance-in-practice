import { describe, expect, it } from "vitest";

import type { InvoiceItem } from "../types";
import { QuoteAgreements } from "./QuoteAgreements";

const SERVICE = "11111111-1111-1111-1111-111111111111";
const line = (patch: Partial<InvoiceItem>): InvoiceItem => ({ description: "CFA Level I", quantity: 1, unitMinor: 300_000, amountMinor: 300_000, ...patch });
const quote = (items: InvoiceItem[], hoursPerMonth: number | null = 30) => ({
  items,
  currency: "AED" as const,
  agreement: { startsOn: "2026-10-17", endsOn: "2027-02-15", hoursPerMonth },
  paymentTerms: "net7" as const,
  termsDays: null,
});

describe("QuoteAgreements", () => {
  it("takes the monthly catalogue line's service and rate, and the quote's dates and hours", () => {
    const result = QuoteAgreements.toAgreement(
      quote([line({ description: "Mock exam", serviceId: SERVICE, unit: "fee", unitMinor: 50_000 }), line({ serviceId: SERVICE, unit: "month", detail: "2 x 90 min a week" })]),
    );
    expect(result).toEqual({
      ok: true,
      input: {
        serviceId: SERVICE,
        unit: "month",
        currency: "AED",
        rateMinor: 300_000,
        startsOn: "2026-10-17",
        endsOn: "2027-02-15",
        paymentTerms: "net7",
        termsDays: null,
        schedule: "",
        scope: "2 x 90 min a week",
        hoursPerMonth: 30,
      },
    });
  });

  it("needs a catalogue line and an agreement block; hours only on a monthly basis", () => {
    expect(QuoteAgreements.toAgreement(quote([line({ unit: "month" })])).ok).toBe(false);
    expect(QuoteAgreements.toAgreement({ ...quote([line({ serviceId: SERVICE, unit: "month" })]), agreement: null }).ok).toBe(false);
    const hourly = QuoteAgreements.toAgreement(quote([line({ serviceId: SERVICE, unit: "hour", unitMinor: 30_000 })]));
    expect(hourly.ok && hourly.input).toMatchObject({ unit: "hour", rateMinor: 30_000, hoursPerMonth: null });
  });
});
