import { describe, expect, it } from "vitest";

import type { ServicePrice } from "../types";
import { SERVICE_SEEDS, serviceSeedStatement } from "../../../../scripts/db/service-seeds.mts";
import { CatalogueContract } from "./CatalogueContract";

const price = (fields: Partial<ServicePrice>): ServicePrice => ({
  id: "p",
  unit: "hour",
  currency: "AED",
  rateMinor: 45_000,
  effectiveFrom: "2026-01-01",
  effectiveTo: null,
  ...fields,
});

describe("CatalogueContract.parseService", () => {
  it("upper-cases the code and keeps the ticked bases in form order", () => {
    const parsed = CatalogueContract.parseService({ code: " cf001 ", name: " CFA Level I tutoring ", units: ["month", "hour"], defaultUnit: "month" });
    expect(parsed).toMatchObject({ ok: true, input: { code: "CF001", name: "CFA Level I tutoring", units: ["month", "hour"], defaultUnit: "month", category: "" } });
  });
  it("refuses bad codes, no bases, unknown bases and a default that isn't ticked", () => {
    for (const code of ["C", "CF 001", "-CF", "C".repeat(21)]) {
      const bad = CatalogueContract.parseService({ code, name: "x", units: ["hour"] });
      expect(bad.ok ? null : bad.errors.code).toBeTruthy();
    }
    expect(CatalogueContract.parseService({ code: "CF001", name: "", units: [] })).toMatchObject({ ok: false, errors: { name: expect.any(String), units: expect.any(String) } });
    expect(CatalogueContract.parseService({ code: "CF001", name: "x", units: ["weekly"] })).toMatchObject({ ok: false, errors: { units: expect.any(String) } });
    expect(CatalogueContract.parseService({ code: "CF001", name: "x", units: ["hour"], defaultUnit: "month" })).toMatchObject({ ok: false, errors: { defaultUnit: expect.any(String) } });
  });
});

describe("CatalogueContract.parsePrice", () => {
  const fields = { unit: "month", currency: "AED", rate: "1,500", effectiveFrom: "2026-10-01" };
  it("reads a price for an offered basis", () => {
    expect(CatalogueContract.parsePrice(fields, ["month"])).toEqual({ unit: "month", currency: "AED", rateMinor: 150_000, effectiveFrom: "2026-10-01", effectiveTo: null });
  });
  it("treats a missing or zero rate as no price, and refuses other bases and backwards dates", () => {
    expect(typeof CatalogueContract.parsePrice({ ...fields, rate: "" }, ["month"])).toBe("string");
    expect(typeof CatalogueContract.parsePrice({ ...fields, rate: "0" }, ["month"])).toBe("string");
    expect(typeof CatalogueContract.parsePrice(fields, ["hour"])).toBe("string");
    expect(typeof CatalogueContract.parsePrice({ ...fields, effectiveTo: "2026-09-30" }, ["month"])).toBe("string");
    expect(typeof CatalogueContract.parsePrice({ ...fields, currency: "BTC" }, ["month"])).toBe("string");
  });
});

describe("CatalogueContract.priceOn", () => {
  const prices = [
    price({ id: "old", effectiveTo: "2026-09-30" }),
    price({ id: "new", rateMinor: 50_000, effectiveFrom: "2026-10-01" }),
    price({ id: "month", unit: "month", rateMinor: 150_000 }),
  ];
  it("finds the price in force on a date", () => {
    expect(CatalogueContract.priceOn(prices, "hour", "AED", "2026-09-30")?.id).toBe("old");
    expect(CatalogueContract.priceOn(prices, "hour", "AED", "2026-10-01")?.id).toBe("new");
  });
  it("never falls back to another basis, currency or date", () => {
    expect(CatalogueContract.priceOn(prices, "session", "AED", "2026-10-01")).toBeNull();
    expect(CatalogueContract.priceOn(prices, "hour", "USD", "2026-10-01")).toBeNull();
    expect(CatalogueContract.priceOn(prices, "hour", "AED", "2025-12-31")).toBeNull();
  });
  it("lists today's prices in basis order", () => {
    expect(CatalogueContract.current({ prices }, "2026-10-09").map((p) => p.id)).toEqual(["month", "new"]); // monthly before hourly
  });
  it("searches code and name", () => {
    const service = { code: "CF001", name: "CFA Level I tutoring" };
    expect(CatalogueContract.matches(service, "cf0")).toBe(true);
    expect(CatalogueContract.matches(service, "level i")).toBe(true);
    expect(CatalogueContract.matches(service, "FRM")).toBe(false);
    expect(CatalogueContract.matches(service, " ")).toBe(true);
  });
});

describe("recommended catalogue (scripts/db/service-seeds.mts)", () => {
  it("passes the same validation as the admin form, with unique codes and no regulated services", () => {
    for (const seed of SERVICE_SEEDS) {
      const parsed = CatalogueContract.parseService({ ...seed, defaultUnit: seed.defaultUnit ?? "" });
      expect(parsed, seed.code).toMatchObject({ ok: true, input: { code: seed.code, units: CatalogueContract.UNIT_ORDER.filter((u) => seed.units.includes(u)) } });
    }
    expect(new Set(SERVICE_SEEDS.map((s) => s.code)).size).toBe(SERVICE_SEEDS.length);
    expect(SERVICE_SEEDS.some((s) => /invest/i.test(`${s.name} ${s.description}`))).toBe(false);
    expect(SERVICE_SEEDS.find((s) => s.code === "CF001")).toMatchObject({ units: ["hour", "month", "session", "package"], defaultUnit: null });
  });
  it("inserts archived, never overwrites, and escapes quotes", () => {
    const sql = serviceSeedStatement();
    expect(sql).toContain("ON CONFLICT (code) DO NOTHING");
    expect(sql).toContain("now() FROM v");
    expect(sql).toContain("the student''s own work");
    expect(sql).not.toMatch(/UPDATE|DELETE/);
  });
});
