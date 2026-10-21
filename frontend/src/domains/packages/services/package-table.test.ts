import { describe, expect, it } from "vitest";

import type { Package } from "../types";
import { PackageTable } from "./PackageTable";

const pkg = (name: string, hours: number | null, priceMinor: number | null, features: [string, string][] = []): Package => ({
  id: name,
  name,
  tagline: "",
  hours,
  priceMinor,
  currency: "AED",
  features: features.map(([label, value]) => ({ label, value })),
  position: 0,
  featured: false,
  isActive: true,
});

describe("PackageTable", () => {
  it("prices per hour and names Custom", () => {
    // Intl puts a no-break space after the currency code.
    expect(PackageTable.perHour(pkg("A", 12, 150000))).toBe("AED\u00a0125 / hour");
    expect(PackageTable.perHour(pkg("C", null, null))).toBeNull();
    expect(PackageTable.price(pkg("C", null, null))).toBe("Agreed with you");
    expect(PackageTable.hours(pkg("A", 1, 15000))).toBe("1 live hour");
  });

  it("moves features every priced package shares into common, keeps the rest as rows", () => {
    const { common, rows } = PackageTable.compare([
      pkg("A", 1, 15000, [["Portal", "Included"], ["Plan", ""]]),
      pkg("B", 12, 150000, [["Portal", "Included"], ["Plan", "Initial plan"]]),
      pkg("C", null, null),
    ]);
    expect(common).toEqual([{ label: "Portal", value: "Included" }]);
    expect(rows).toEqual([{ label: "Plan", values: ["", "Initial plan"] }]);
  });

  it("offers only Custom to a course that isn't an exam course", () => {
    const all = [pkg("A", 1, 15000), pkg("C", null, null)];
    expect(PackageTable.forCourse(all, false).map((p) => p.name)).toEqual(["C"]);
    expect(PackageTable.forCourse(all, true)).toHaveLength(2);
  });

  it("parses the admin form, Custom without hours or price", () => {
    const base = { name: "Structured", currency: "AED", features: "Plan: Initial plan\nPortal", position: "2", isActive: "yes" };
    const ok = PackageTable.parse({ ...base, hours: "12", price: "1,500" });
    expect(ok.ok && ok.input).toMatchObject({ hours: 12, priceMinor: 150000, features: [{ label: "Plan", value: "Initial plan" }, { label: "Portal", value: "" }] });
    const custom = PackageTable.parse({ ...base, custom: "yes", hours: "x" });
    expect(custom.ok && custom.input).toMatchObject({ hours: null, priceMinor: null });
    expect(PackageTable.parse({ ...base, hours: "0", price: "" }).ok).toBe(false);
  });
});
