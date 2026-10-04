import "server-only";

import { BaseApiClient } from "@/core/http/BaseApiClient";

import sample from "../data/market-pulse.sample.json";
import { MarketPulseContract } from "../services/MarketPulseContract";
import type { MarketPulse } from "../types";

/**
 * Reads the Market Pulse JSON that PortX publishes daily to Vercel Blob
 * (MARKET_PULSE_URL). The home page's ISR window (revalidate = 3600) is the
 * cache, so the Blob is read at most once an hour.
 */
export class MarketPulseSource extends BaseApiClient {
  private constructor(origin: string, fetchImpl?: typeof fetch) {
    super({ baseUrl: origin, timeoutMs: 5_000, fetchImpl });
  }

  private fetchPulse(url: URL): Promise<unknown> {
    return this.get<unknown>(url.pathname + url.search);
  }

  /**
   * Live payload when MARKET_PULSE_URL is set. Without it, development falls
   * back to the bundled sample and production returns null, so made-up
   * numbers never reach the public site.
   *
   * A failed read during an hourly refresh throws on purpose: ISR then keeps
   * serving the last good page (e.g. Friday's closes) instead of an empty card.
   * Only the build, which has no earlier page to fall back to, gets null.
   */
  static async load(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch): Promise<MarketPulse | null> {
    const url = env.MARKET_PULSE_URL?.trim();
    if (!url) return env.NODE_ENV === "production" ? null : MarketPulseSource.sample();

    let pulse: MarketPulse | null = null;
    let failure: unknown = "invalid payload";
    try {
      const target = new URL(url);
      pulse = MarketPulseContract.parse(await new MarketPulseSource(target.origin, fetchImpl).fetchPulse(target));
    } catch (error) {
      failure = error;
    }
    if (pulse) return pulse;

    console.error("[market-pulse] read failed", failure);
    const keepLastGood = env.NODE_ENV === "production" && env.NEXT_PHASE !== "phase-production-build";
    if (keepLastGood) throw new Error("Market Pulse unavailable; keeping the last generated page");
    return null;
  }

  static sample(): MarketPulse | null {
    const pulse = MarketPulseContract.parse(sample);
    return pulse && { ...pulse, series: pulse.series.map((s) => ({ ...s, source: `${s.source} (sample)` })) };
  }
}
