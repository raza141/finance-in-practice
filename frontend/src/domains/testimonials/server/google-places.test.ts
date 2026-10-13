import { describe, expect, it, vi } from "vitest";

import { GooglePlacesClient } from "./GooglePlacesClient";

describe("GooglePlacesClient", () => {
  it("needs both the key and the place ID", () => {
    expect(GooglePlacesClient.fromEnv({ GOOGLE_PLACES_API_KEY: "k" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(GooglePlacesClient.fromEnv({ GOOGLE_PLACE_ID: "p" } as unknown as NodeJS.ProcessEnv)).toBeNull();
  });

  it("maps the place and drops star-only reviews", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        rating: 5,
        userRatingCount: 2,
        reviews: [
          {
            rating: 5,
            relativePublishTimeDescription: "a week ago",
            text: { text: " Clear and patient. " },
            authorAttribution: { displayName: "Sara K", uri: "https://maps.google.com/u/1", photoUri: "https://lh3.googleusercontent.com/a" },
          },
          { rating: 4, authorAttribution: { displayName: "No Text" } },
        ],
      }),
    );
    const client = new GooglePlacesClient("ChIJabc", "secret", fetchImpl as typeof fetch);

    expect(await client.rating()).toEqual({
      rating: 5,
      count: 2,
      reviews: [
        { author: "Sara K", authorUrl: "https://maps.google.com/u/1", photoUrl: "https://lh3.googleusercontent.com/a", rating: 5, text: "Clear and patient.", when: "a week ago" },
      ],
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJabc?languageCode=en");
    expect(new Headers(init.headers).get("X-Goog-FieldMask")).toBe("rating,userRatingCount,reviews");
  });
});
