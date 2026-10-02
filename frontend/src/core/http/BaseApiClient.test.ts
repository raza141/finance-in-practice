import { describe, expect, it, vi } from "vitest";

import { ApiError } from "./ApiError";
import { BaseApiClient, type ApiClientOptions } from "./BaseApiClient";

class TestClient extends BaseApiClient {
  constructor(options: Partial<ApiClientOptions> = {}) {
    super({ baseUrl: "http://api.test/", ...options });
  }
  fetchThing = (signal?: AbortSignal) => this.get<{ ok: boolean }>("/thing", { signal });
  sendThing = (body: unknown) => this.post<{ id: number }>("thing", body);
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });

async function captureError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error("expected the request to fail");
}

describe("BaseApiClient", () => {
  it("joins base URL and path and parses JSON", async () => {
    const fetchImpl = vi.fn(async () => json(200, { ok: true }));
    const client = new TestClient({ fetchImpl });

    await expect(client.fetchThing()).resolves.toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith("http://api.test/thing", expect.any(Object));
  });

  it("serialises POST bodies with a JSON content type", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ a: 1 }));
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      return json(200, { id: 7 });
    });
    await expect(new TestClient({ fetchImpl }).sendThing({ a: 1 })).resolves.toEqual({ id: 7 });
  });

  it("maps FastAPI domain errors (detail string) to validation errors", async () => {
    const fetchImpl = vi.fn(async () =>
      json(422, { detail: "price violates no-arbitrage bounds", type: "InvalidInputError" }),
    );
    const error = await captureError(new TestClient({ fetchImpl }).fetchThing());
    expect(error.kind).toBe("validation");
    expect(error.status).toBe(422);
    expect(error.message).toBe("price violates no-arbitrage bounds");
  });

  it("flattens FastAPI request-validation errors (detail array)", async () => {
    const fetchImpl = vi.fn(async () =>
      json(422, {
        detail: [
          { loc: ["body", "spot"], msg: "Input should be greater than 0" },
          { loc: ["body", "volatility"], msg: "Field required" },
        ],
      }),
    );
    const error = await captureError(new TestClient({ fetchImpl }).fetchThing());
    expect(error.message).toBe(
      "spot: Input should be greater than 0; volatility: Field required",
    );
  });

  it("reports rate limiting with Retry-After", async () => {
    const fetchImpl = vi.fn(async () =>
      json(429, { detail: "rate limit exceeded" }, { "Retry-After": "42" }),
    );
    const error = await captureError(new TestClient({ fetchImpl }).fetchThing());
    expect(error.kind).toBe("rate_limited");
    expect(error.retryAfterSeconds).toBe(42);
    expect(error.isRetryable).toBe(true);
  });

  it("maps other HTTP failures to http errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("boom", { status: 500 }));
    const error = await captureError(new TestClient({ fetchImpl }).fetchThing());
    expect(error.kind).toBe("http");
    expect(error.status).toBe(500);
  });

  it("times out slow requests", async () => {
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    const error = await captureError(new TestClient({ fetchImpl, timeoutMs: 20 }).fetchThing());
    expect(error.kind).toBe("timeout");
  });

  it("distinguishes caller cancellation from timeouts", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
          controller.abort();
        }),
    );
    const error = await captureError(
      new TestClient({ fetchImpl }).fetchThing(controller.signal),
    );
    expect(error.kind).toBe("aborted");
  });

  it("wraps network failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    const error = await captureError(new TestClient({ fetchImpl }).fetchThing());
    expect(error.kind).toBe("network");
    expect(error.message).toContain("fetch failed");
  });

  it("flags invalid JSON bodies as parse errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("not json", { status: 200 }));
    const error = await captureError(new TestClient({ fetchImpl }).fetchThing());
    expect(error.kind).toBe("parse");
  });
});
