import "server-only";

import { siteConfig } from "@/core/config/site";
import { BaseApiClient } from "@/core/http/BaseApiClient";

export interface GoogleRating {
  rating: number;
  count: number;
}

/**
 * Server-only Places API (New) client for the Business Profile's star rating
 * and review count. The key never leaves the server.
 */
export class GooglePlacesClient extends BaseApiClient {
  static readonly BASE_URL = "https://places.googleapis.com/v1";
  static readonly FIELDS = "rating,userRatingCount";

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

  /** Null without GOOGLE_PLACES_API_KEY: the buttons then show without the rating. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env, placeId: string = siteConfig.contact.googlePlaceId): GooglePlacesClient | null {
    const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
    if (!apiKey || !placeId) return null;
    return new GooglePlacesClient(placeId, apiKey);
  }

  async rating(): Promise<GoogleRating> {
    const place = await this.get<{ rating?: number; userRatingCount?: number }>(
      `/places/${encodeURIComponent(this.placeId)}`,
    );
    return { rating: place.rating ?? 0, count: place.userRatingCount ?? 0 };
  }
}
