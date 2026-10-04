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
   */
  static async load(env: NodeJS.ProcessEnv = process.env, fetchImpl?: typeof fetch): Promise<MarketPulse | null> {
    const url = env.MARKET_PULSE_URL?.trim();
    if (!url) return env.NODE_ENV === "production" ? null : MarketPulseSource.sample();
    try {
      const target = new URL(url);
      return MarketPulseContract.parse(await new MarketPulseSource(target.origin, fetchImpl).fetchPulse(target));
    } catch (error) {
      console.error("[market-pulse] fetch failed", error);
      return null;
    }
  }

  static sample(): MarketPulse | null {
    const pulse = MarketPulseContract.parse(sample);
    return pulse && { ...pulse, series: pulse.series.map((s) => ({ ...s, source: `${s.source} (sample)` })) };
  }
}
