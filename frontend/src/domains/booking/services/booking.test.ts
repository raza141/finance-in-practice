import { describe, expect, it } from "vitest";

import { TerminalAnimator } from "../animations/TerminalAnimator";
import { MockAvailabilityProvider } from "./AvailabilityProvider";
import { BookingCatalog } from "./BookingCatalog";
import { LiquidityCurveGeometry, type ChartBox } from "./LiquidityCurveGeometry";
import { TerminalFormat } from "./TerminalFormat";

const BOX: ChartBox = { width: 640, height: 250, padding: { top: 18, right: 18, bottom: 34, left: 34 } };
const FIXED_NOW = () => new Date("2026-10-02T09:00:00Z"); // 13:00 GST, a Friday

describe("MockAvailabilityProvider", () => {
  const provider = new MockAvailabilityProvider(0, FIXED_NOW);

  it("projects N consecutive days starting tomorrow in GST", async () => {
    const days = await provider.getProjection({ track: "cfa", days: 14 });
    expect(days).toHaveLength(14);
    expect(days[0].date).toBe("2026-10-03");
    expect(days[13].date).toBe("2026-10-16");
  });

  it("is deterministic per date and track", async () => {
    const a = await provider.getProjection({ track: "frm", days: 14 });
    const b = await provider.getProjection({ track: "frm", days: 14 });
    expect(a).toEqual(b);
  });

  it("produces sorted, well-formed slots with correct UTC instants and sides", async () => {
    const days = await provider.getProjection({ track: "systems", days: 14 });
    for (const day of days) {
      const labels = day.slots.map((s) => s.label);
      expect(labels).toEqual([...labels].sort());
      for (const slot of day.slots) {
        const [h, m] = slot.label.split(":").map(Number);
        const utc = new Date(slot.start);
        expect(utc.getUTCHours()).toBe((h - 4 + 24) % 24); // GST = UTC+4
        expect(utc.getUTCMinutes()).toBe(m);
        expect(slot.side).toBe(slot.label >= "17:00" ? "ASK" : "BID");
      }
    }
  });

  it("keeps weekends thinner than weekdays", async () => {
    const days = await provider.getProjection({ track: "uni", days: 14 });
    for (const day of days) {
      const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      const cap = weekday === 0 || weekday === 6 ? 2 : 5;
      expect(day.slots.length).toBeLessThanOrEqual(cap);
    }
  });

  it("supports cancellation", async () => {
    const slow = new MockAvailabilityProvider(10_000, FIXED_NOW);
    const controller = new AbortController();
    const pending = slow.getProjection({ track: "cfa", days: 3 }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("LiquidityCurveGeometry", () => {
  const geometry = new LiquidityCurveGeometry([0, 2, 5, 3, 1], BOX);

  it("maps the first and last nodes to the plot edges", () => {
    expect(geometry.points[0].x).toBe(BOX.padding.left);
    expect(geometry.points[4].x).toBe(BOX.width - BOX.padding.right);
  });

  it("maps 0 to the baseline and yMax to the top", () => {
    expect(geometry.points[0].y).toBe(BOX.height - BOX.padding.bottom);
    expect(geometry.points[2].y).toBe(BOX.padding.top);
  });

  it("finds the nearest node for a pointer x", () => {
    expect(geometry.nearestIndex(-100)).toBe(0);
    expect(geometry.nearestIndex(geometry.xAt(3) + 4)).toBe(3);
    expect(geometry.nearestIndex(10_000)).toBe(4);
  });

  it("emits a curve through every node and a closed band", () => {
    const curve = geometry.curvePath();
    expect(curve.startsWith(`M${geometry.points[0].x},${geometry.points[0].y}`)).toBe(true);
    expect(curve.match(/C/g)).toHaveLength(4);
    expect(geometry.bandPath().endsWith("Z")).toBe(true);
  });

  it("never overshoots: every Bézier control point stays within its segment's range", () => {
    const spiky = new LiquidityCurveGeometry([0, 0, 4, 0, 5, 0, 1, 1, 1, 3, 4, 0, 2], BOX);
    const numbers = spiky.curvePath().match(/-?\d+(\.\d+)?/g)!.map(Number);
    const ys = spiky.points.map((p) => p.y);
    // path = M x0,y0 then per segment: C c1x,c1y c2x,c2y x,y
    for (let k = 0; k < ys.length - 1; k++) {
      const [, c1y, , c2y] = numbers.slice(2 + k * 6, 2 + k * 6 + 4);
      const lo = Math.min(ys[k], ys[k + 1]) - 0.01;
      const hi = Math.max(ys[k], ys[k + 1]) + 0.01;
      expect(c1y).toBeGreaterThanOrEqual(lo);
      expect(c1y).toBeLessThanOrEqual(hi);
      expect(c2y).toBeGreaterThanOrEqual(lo);
      expect(c2y).toBeLessThanOrEqual(hi);
    }
  });

  it("uses a minimum y-scale so sparse curves are not exaggerated", () => {
    expect(new LiquidityCurveGeometry([1, 1, 2], BOX).yMax).toBe(5);
    expect(new LiquidityCurveGeometry([1, 8, 2], BOX).yMax).toBe(8);
  });
});

describe("TerminalFormat", () => {
  it("formats dates without locale dependence", () => {
    expect(TerminalFormat.date("2026-10-08")).toBe("OCT 08");
    expect(TerminalFormat.weekday("2026-10-08")).toBe("THU");
    expect(TerminalFormat.slots(1)).toBe("1 SLOT");
    expect(TerminalFormat.slots(4)).toBe("4 SLOTS");
  });
});

describe("TerminalAnimator.scrambled", () => {
  const text = "[ DIVIDEND CAPTURED: DEMO SCHEDULED ]";

  it("locks characters left to right and preserves spaces", () => {
    const half = TerminalAnimator.scrambled(text, 0.5);
    const locked = Math.floor(text.length * 0.5);
    expect(half).toHaveLength(text.length);
    expect(half.slice(0, locked)).toBe(text.slice(0, locked));
    [...text].forEach((ch, i) => ch === " " && expect(half[i]).toBe(" "));
    expect(TerminalAnimator.scrambled(text, 1)).toBe(text);
  });
});

describe("BookingCatalog", () => {
  it("builds a Cal.com hand-off URL with the chosen date preselected", () => {
    const previous = process.env.NEXT_PUBLIC_CAL_LINK;
    process.env.NEXT_PUBLIC_CAL_LINK = "someone/30min";
    try {
      expect(new BookingCatalog().confirmationUrl("2026-10-14")).toBe(
        "https://cal.com/someone/30min?date=2026-10-14&month=2026-10",
      );
      process.env.NEXT_PUBLIC_CAL_LINK = "";
      expect(new BookingCatalog().confirmationUrl("2026-10-14")).toBeNull();
    } finally {
      process.env.NEXT_PUBLIC_CAL_LINK = previous;
    }
  });

  it("exposes the four terminal tracks", () => {
    expect(new BookingCatalog().tracks().map((t) => t.ticker)).toEqual([
      "CFA L1/L2",
      "FRM P1",
      "UNI FINANCE",
      "SYSTEM BUILDING",
    ]);
  });
});
