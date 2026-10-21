import { describe, expect, it } from "vitest";

import { BillingBasis } from "./BillingBasis";
import { RegistrationContract } from "./RegistrationContract";

const cfa = { hourMinor: 45_000, monthMinor: 300_000, monthHours: 30, currency: "AED" };
const plan = (unit: "hour" | "month") => ({ unit, feeMinor: 1, currency: "AED" as const });
const monthly = { unit: "month" as const, period: { number: 1, of: 1, start: "2026-10-17", end: "2026-11-14" } };

describe("BillingBasis", () => {
  it("prices each basis from the course, or says it is agreed", () => {
    expect(BillingBasis.price("hour", cfa)).toMatchObject({ amount: expect.stringMatching(/^AED\s450$/), detail: "an hour, pay for the time you book" });
    expect(BillingBasis.price("month", cfa).detail).toBe("a month, 30 h of 1-on-1 included");
    expect(BillingBasis.price("month", { ...cfa, monthMinor: null }).amount).toBe("Agreed with you");
    expect(BillingBasis.price("hour", null).amount).toBe("Agreed with you");
  });

  it("shows what they pay on, an open switch, and when monthly ends", () => {
    expect(BillingBasis.state(null, "month")).toEqual({ current: null, requested: "month", monthEnds: null });
    expect(BillingBasis.state({ plan: plan("hour"), agreements: [] }, "month")).toMatchObject({ current: "hour", requested: "month" });
    // Their agreement was accepted: the request is done.
    const onMonthly = { plan: plan("month"), agreements: [monthly as never] };
    expect(BillingBasis.state(onMonthly, "month")).toEqual({ current: "month", requested: null, monthEnds: "2026-11-14" });
    expect(BillingBasis.state(onMonthly, "hour")).toEqual({ current: "month", requested: "hour", monthEnds: "2026-11-14" });
  });
});

describe("RegistrationContract basis", () => {
  const base = { name: "Ali Khan", email: "ali@example.com", phone: "+971 50 123 4567", course: "CFA Level I", acceptTerms: "yes" };
  it("requires hourly or monthly", () => {
    expect(RegistrationContract.parse(base, ["CFA Level I"])).toEqual({ ok: false, error: "Choose hourly or monthly." });
    expect(RegistrationContract.parse({ ...base, basis: "weekly" }, ["CFA Level I"]).ok).toBe(false);
    const ok = RegistrationContract.parse({ ...base, basis: "month" }, ["CFA Level I"]);
    expect(ok.ok && ok.value.basis).toBe("month");
  });
});
