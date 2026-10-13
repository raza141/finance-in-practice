import { describe, expect, it, vi } from "vitest";

import { GooglePlacesClient } from "./GooglePlacesClient";

describe("GooglePlacesClient", () => {
  it("needs the key and a place ID", () => {
    expect(GooglePlacesClient.fromEnv({} as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(GooglePlacesClient.fromEnv({ GOOGLE_PLACES_API_KEY: "k" } as unknown as NodeJS.ProcessEnv, "")).toBeNull();
    expect(GooglePlacesClient.fromEnv({ GOOGLE_PLACES_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).not.toBeNull();
  });

  it("reads the rating and count, defaulting to 0", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ rating: 5, userRatingCount: 2 }));
    const client = new GooglePlacesClient("ChIJabc", "secret", fetchImpl as typeof fetch);
    expect(await client.rating()).toEqual({ rating: 5, count: 2 });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJabc");
    expect(new Headers(init.headers).get("X-Goog-FieldMask")).toBe("rating,userRatingCount");

    const empty = new GooglePlacesClient("ChIJabc", "secret", (async () => Response.json({})) as typeof fetch);
    expect(await empty.rating()).toEqual({ rating: 0, count: 0 });
  });
});
