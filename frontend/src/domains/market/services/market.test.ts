import { describe, expect, it } from "vitest";

import sample from "../data/market-pulse.sample.json";
import { MarketPulseSource } from "../server/MarketPulseSource";
import { MarketPulseContract } from "./MarketPulseContract";
import { PulseChartGeometry } from "./PulseChartGeometry";

describe("MarketPulseContract", () => {
  it("parses the sample and keeps all five rows", () => {
    expect(MarketPulseContract.parse(sample)?.series.map((s) => s.key)).toEqual(["SPX", "ADX", "KSE100", "VIX", "UST3M"]);
  });

  it("drops only the malformed series", () => {
    const broken = { ...sample, series: [...sample.series, { key: "BAD", value: "n/a" }] };
    expect(MarketPulseContract.parse(broken)?.series).toHaveLength(5);
    expect(MarketPulseContract.parse({ generated_at: "nope", series: sample.series })).toBeNull();
    expect(MarketPulseContract.parse({ ...sample, series: [] })).toBeNull();
  });

  it("formats changes in pct and bps", () => {
    const [spx, adx, , , ust] = MarketPulseContract.parse(sample)!.series;
    expect(MarketPulseContract.formatChange({ ...spx, change: 0.4 })).toBe("+0.40%");
    expect(MarketPulseContract.formatChange({ ...ust, change: -2 })).toBe("−2 bps");
    expect(MarketPulseContract.formatChange(adx)).toBe("—");
    expect(MarketPulseContract.formatValue(ust)).toMatch(/%$/);
    expect(MarketPulseContract.formatDate("2026-09-05")).toBe("05 SEP");
  });

  it("credits PortX once, then each feed", () => {
    expect(MarketPulseContract.formatSources(MarketPulseContract.parse(sample)!)).toBe("PortX · yfinance · PSX · FRED (DTB3)");
  });

  it("accepts null norm for rate series", () => {
    expect(MarketPulseContract.parse(sample)!.series.find((s) => s.key === "UST3M")!.history).toHaveLength(21);
  });

  it("never flags Friday's close over the weekend; counts weekdays only", () => {
    const series = MarketPulseContract.parse(sample)!.series;
    const spx = series[0]; // as_of Fri 2026-10-02
    const ust = series.find((s) => s.key === "UST3M")!; // as_of Thu 2026-10-01 (FRED lag)
    for (const now of ["2026-10-03T12:00:00Z", "2026-10-04T23:00:00Z", "2026-10-05T08:00:00Z"]) {
      expect(MarketPulseContract.isStale(spx, new Date(now))).toBe(false);
      expect(MarketPulseContract.isStale(ust, new Date(now))).toBe(false);
    }
    expect(MarketPulseContract.isStale(spx, new Date("2026-10-07T12:00:00Z"))).toBe(false); // Mon-Wed: 3 weekdays
    expect(MarketPulseContract.isStale(spx, new Date("2026-10-08T12:00:00Z"))).toBe(true); // Thursday: 4
  });
});

describe("PulseChartGeometry", () => {
  it("charts equity indices with enough history only", () => {
    const chart = new PulseChartGeometry().build(MarketPulseContract.parse(sample)!.series)!;
    expect(chart.lines.map((l) => l.key)).toEqual(["SPX", "KSE100"]); // ADX has 1 close; VIX/T-bill never charted
    for (const l of chart.lines) {
      for (const { x, y } of l.points) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(chart.width);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(chart.height);
      }
    }
  });

  it("finds each line's nearest day for the tooltip", () => {
    const chart = new PulseChartGeometry().build(MarketPulseContract.parse(sample)!.series)!;
    const [spx] = PulseChartGeometry.nearest(chart, chart.width);
    expect(spx.point.date).toBe("2026-10-02");
    expect(PulseChartGeometry.nearest(chart, 0)[0].point.norm).toBe(100);
  });
});

describe("MarketPulseSource", () => {
  it("never serves the sample in production", async () => {
    expect(await MarketPulseSource.load({ NODE_ENV: "production" } as NodeJS.ProcessEnv)).toBeNull();
    expect((await MarketPulseSource.load({ NODE_ENV: "development" } as NodeJS.ProcessEnv))?.series[0].source).toMatch(/sample/);
  });

  it("reads the Blob URL; a failed refresh throws so ISR keeps the last page, a failed build gets null", async () => {
    const env = { NODE_ENV: "production", MARKET_PULSE_URL: "https://x.public.blob.vercel-storage.com/market-pulse/latest.json" } as NodeJS.ProcessEnv;
    const ok = (async (url: string) => {
      expect(url).toBe(env.MARKET_PULSE_URL);
      return new Response(JSON.stringify(sample), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    expect((await MarketPulseSource.load(env, ok))?.series).toHaveLength(5);
    const down = (async () => new Response("", { status: 503 })) as typeof fetch;
    const junk = (async () => new Response("{}", { headers: { "Content-Type": "application/json" } })) as typeof fetch;
    await expect(MarketPulseSource.load(env, down)).rejects.toThrow(/keeping the last generated page/);
    await expect(MarketPulseSource.load(env, junk)).rejects.toThrow();
    expect(await MarketPulseSource.load({ ...env, NEXT_PHASE: "phase-production-build" }, down)).toBeNull();
  });
});
