import { describe, expect, it, vi } from "vitest";

import { QuantApiClient } from "./QuantApiClient";

function recordingFetch(response: unknown = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(response), { status: 200 });
  });
  return { calls, fetchImpl };
}

describe("QuantApiClient", () => {
  it("routes domain calls under /api/v1", async () => {
    const { calls, fetchImpl } = recordingFetch({ price: 4.76 });
    const client = new QuantApiClient({ baseUrl: "http://localhost:8000", fetchImpl });

    await client.blackScholes({
      spot: 42,
      strike: 40,
      time_to_expiry: 0.5,
      rate: 0.1,
      volatility: 0.2,
    });

    expect(calls[0].url).toBe("http://localhost:8000/api/v1/pricing/black-scholes");
    expect(calls[0].init?.method).toBe("POST");
  });

  it("keeps the health check at the API root", async () => {
    const { calls, fetchImpl } = recordingFetch({ status: "ok", version: "0.1.0" });
    await new QuantApiClient({ baseUrl: "http://localhost:8000/", fetchImpl }).health();
    expect(calls[0].url).toBe("http://localhost:8000/health");
  });

  it("uses GET for scenario listing and POST for optimisation", async () => {
    const { calls, fetchImpl } = recordingFetch([]);
    const client = new QuantApiClient({ baseUrl: "http://x", fetchImpl });
    await client.stressScenarios();
    await client.optimizePortfolio({
      assets: ["A", "B"],
      expected_returns: [0.08, 0.13],
      covariance: [
        [0.0144, 0.0072],
        [0.0072, 0.04],
      ],
    });
    expect(calls.map((c) => [c.init?.method, c.url])).toEqual([
      ["GET", "http://x/api/v1/stress-test/scenarios"],
      ["POST", "http://x/api/v1/portfolio/optimize"],
    ]);
  });

  it("exposes a shared singleton", () => {
    expect(QuantApiClient.shared()).toBe(QuantApiClient.shared());
  });
});
