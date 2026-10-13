import "server-only";

import { BaseApiClient } from "@/core/http/BaseApiClient";

export interface GoogleReview {
  author: string;
  /** The reviewer's Google Maps profile; Google's terms require linking it. */
  authorUrl: string | null;
  photoUrl: string | null;
  rating: number;
  text: string;
  /** Google's own wording, e.g. "2 weeks ago". */
  when: string;
}

export interface GoogleRating {
  rating: number;
  count: number;
  /** At most 5, picked by Google ("most relevant"). */
  reviews: GoogleReview[];
}

interface PlaceResponse {
  rating?: number;
  userRatingCount?: number;
  reviews?: {
    rating?: number;
    relativePublishTimeDescription?: string;
    text?: { text?: string };
    originalText?: { text?: string };
    authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
  }[];
}

/**
 * Server-only Places API (New) client for the Business Profile's rating and
 * reviews. The key never leaves the server.
 */
export class GooglePlacesClient extends BaseApiClient {
  static readonly BASE_URL = "https://places.googleapis.com/v1";
  static readonly FIELDS = "rating,userRatingCount,reviews";

  constructor(
    private readonly placeId: string,
    apiKey: string,
    fetchImpl?: typeof fetch,
  ) {
    super({
      baseUrl: GooglePlacesClient.BASE_URL,
      timeoutMs: 8_000,
      defaultHeaders: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": GooglePlacesClient.FIELDS },
      fetchImpl,
    });
  }

  /** Null when GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID is missing: the page then shows the review button only. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): GooglePlacesClient | null {
    const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
    const placeId = env.GOOGLE_PLACE_ID?.trim();
    if (!apiKey || !placeId) return null;
    return new GooglePlacesClient(placeId, apiKey);
  }

  async rating(): Promise<GoogleRating> {
    const place = await this.get<PlaceResponse>(`/places/${encodeURIComponent(this.placeId)}?languageCode=en`);
    return {
      rating: place.rating ?? 0,
      count: place.userRatingCount ?? 0,
      reviews: (place.reviews ?? [])
        .map((r) => ({
          author: r.authorAttribution?.displayName ?? "Google user",
          authorUrl: r.authorAttribution?.uri ?? null,
          photoUrl: r.authorAttribution?.photoUri ?? null,
          rating: r.rating ?? 0,
          text: (r.text?.text ?? r.originalText?.text ?? "").trim(),
          when: r.relativePublishTimeDescription ?? "",
        }))
        // A star-only review has nothing to quote.
        .filter((r) => r.text),
    };
  }
}
