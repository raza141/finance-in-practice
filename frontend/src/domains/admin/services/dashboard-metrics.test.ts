import { describe, expect, it } from "vitest";

import { DashboardMetrics } from "./DashboardMetrics";

describe("DashboardMetrics", () => {
  it("lists the last six months across a year boundary", () => {
    expect(DashboardMetrics.lastMonths("2026-02-15")).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("charts the currency with the most income, filling empty months", () => {
    const chart = DashboardMetrics.incomeChart(
      [
        { month: "2026-10", currency: "AED", totalMinor: 500_000 },
        { month: "2026-08", currency: "AED", totalMinor: 100_000 },
        { month: "2026-10", currency: "USD", totalMinor: 200_000 },
      ],
      "2026-10-05",
    );
    expect(chart.currency).toBe("AED");
    expect(chart.bars.map((b) => b.totalMinor)).toEqual([0, 0, 0, 100_000, 0, 500_000]);
    expect(chart.bars.at(-1)?.label).toBe("Oct");
    expect(DashboardMetrics.incomeChart([], "2026-10-05").currency).toBe("AED");
  });

  it("computes change and formats mixed currencies", () => {
    expect(DashboardMetrics.change(150, 100)).toBe(50);
    expect(DashboardMetrics.change(50, 0)).toBeNull();
    expect(DashboardMetrics.amounts([{ currency: "AED", minor: 120_000 }, { currency: "USD", minor: 0 }, { currency: "GBP", minor: 5_000 }])).toBe("AED 1,200.00 · GBP 50.00");
    expect(DashboardMetrics.amounts([])).toBe("AED 0.00");
  });
});
