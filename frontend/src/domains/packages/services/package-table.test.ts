import { describe, expect, it } from "vitest";

import type { Package, PackageAudience, PackageBilling } from "../types";
import { PackageTable } from "./PackageTable";

const pkg = (
  name: string,
  hours: number | null,
  priceMinor: number | null,
  features: [string, string][] = [],
  billing: PackageBilling = "package",
  audience: PackageAudience = "exam",
): Package => ({
  id: name,
  name,
  tagline: "",
  hours,
  priceMinor,
  currency: "AED",
  billing,
  audience,
  features: features.map(([label, value]) => ({ label, value })),
  position: 0,
  featured: false,
  isActive: true,
});

describe("PackageTable", () => {
  it("prices per hour, per month and names Custom", () => {
    // Intl puts a no-break space after the currency code.
    expect(PackageTable.perHour(pkg("A", 12, 150000))).toBe("AED 125 / hour");
    expect(PackageTable.perHour(pkg("A", 1, 15000))).toBeNull();
    expect(PackageTable.price(pkg("C", null, null))).toBe("Agreed with you");
    expect(PackageTable.hours(pkg("A", 1, 15000))).toBe("1 live hour");
    const monthly = pkg("M", 20, 200000, [], "month", "university");
    expect([PackageTable.per(monthly), PackageTable.hours(monthly), PackageTable.perHour(monthly)]).toEqual(["/ month", "20 live hours a month", null]);
    const hourly = pkg("H", null, 10000, [], "hour", "university");
    expect([PackageTable.per(hourly), PackageTable.hours(hourly), PackageTable.isCustom(hourly)]).toEqual(["/ hour", "No minimum", false]);
  });

  it("moves features every priced package shares to common; each card keeps only what it includes", () => {
    const { common, own } = PackageTable.compare([
      pkg("A", 1, 15000, [["Portal", "Included"], ["Plan", ""]]),
      pkg("B", 12, 150000, [["Portal", "Included"], ["Plan", "Initial plan"]]),
      pkg("C", null, null),
    ]);
    expect(common).toEqual([{ label: "Portal", value: "Included" }]);
    expect(own.get("A")).toEqual([]);
    expect(own.get("B")).toEqual([{ label: "Plan", value: "Initial plan" }]);
  });

  it("offers exam, university, Custom-only or (a typed subject) university and Custom", () => {
    const all = [pkg("A", 1, 15000), pkg("C", null, null), pkg("U", null, 10000, [], "hour", "university")];
    const names = (group: Parameters<typeof PackageTable.forCourse>[1]) => PackageTable.forCourse(all, group).map((p) => p.name);
    expect(names("exam")).toEqual(["A", "C"]);
    expect(names("university")).toEqual(["U"]);
    expect(names("other")).toEqual(["C"]);
    expect(names("open")).toEqual(["C", "U"]);
    expect(PackageTable.groupOf({ sittings: [], category: "Uni Finance" })).toBe("university");
  });

  it("parses the admin form: hourly has no hours, Custom has no price", () => {
    const base = { name: "Structured", currency: "AED", features: "Plan: Initial plan\nPortal", position: "2", isActive: "yes", billing: "package", audience: "exam" };
    const ok = PackageTable.parse({ ...base, hours: "12", price: "1,500" });
    expect(ok.ok && ok.input).toMatchObject({ hours: 12, priceMinor: 150000, features: [{ label: "Plan", value: "Initial plan" }, { label: "Portal", value: "" }] });
    const hourly = PackageTable.parse({ ...base, billing: "hour", hours: "", price: "100" });
    expect(hourly.ok && hourly.input).toMatchObject({ hours: null, priceMinor: 10000, billing: "hour" });
    const custom = PackageTable.parse({ ...base, custom: "yes", hours: "x" });
    expect(custom.ok && custom.input).toMatchObject({ hours: null, priceMinor: null });
    expect(PackageTable.parse({ ...base, hours: "0", price: "" }).ok).toBe(false);
  });
});
