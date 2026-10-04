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

  it("flags a close older than four days as stale", () => {
    const spx = MarketPulseContract.parse(sample)!.series[0];
    expect(MarketPulseContract.isStale(spx, new Date("2026-10-05T12:00:00Z"))).toBe(false); // over a weekend
    expect(MarketPulseContract.isStale(spx, new Date("2026-10-08T12:00:00Z"))).toBe(true);
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

  it("reads the Blob URL and returns null on failure", async () => {
    const env = { NODE_ENV: "production", MARKET_PULSE_URL: "https://x.public.blob.vercel-storage.com/market-pulse/latest.json" } as NodeJS.ProcessEnv;
    const ok = (async (url: string) => {
      expect(url).toBe(env.MARKET_PULSE_URL);
      return new Response(JSON.stringify(sample), { headers: { "Content-Type": "application/json" } });
    }) as typeof fetch;
    expect((await MarketPulseSource.load(env, ok))?.series).toHaveLength(5);
    const down = (async () => new Response("", { status: 503 })) as typeof fetch;
    expect(await MarketPulseSource.load(env, down)).toBeNull();
  });
});
