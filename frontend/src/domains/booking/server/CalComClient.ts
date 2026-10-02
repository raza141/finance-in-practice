import "server-only";

import { BaseApiClient } from "@/core/http/BaseApiClient";

export interface CalConfig {
  apiKey: string;
  username: string;
  eventTypeSlug: string;
}

export interface CalSlot {
  start: string;
  end: string;
}

export interface CalBookingInput {
  start: string;
  attendee: { name: string; email: string; timeZone: string; language: string };
  metadata: Record<string, string>;
}

export interface CalBooking {
  uid: string;
  start: string;
  end: string;
  status: string;
}

/**
 * Server-only Cal.com API v2 client. The API key never leaves the server:
 * importing this module from a Client Component fails the build.
 */
export class CalComClient extends BaseApiClient {
  static readonly BASE_URL = "https://api.cal.com/v2";
  static readonly SLOTS_API_VERSION = "2024-09-04";
  static readonly BOOKINGS_API_VERSION = "2026-02-25";

  constructor(
    private readonly config: CalConfig,
    fetchImpl?: typeof fetch,
  ) {
    super({
      baseUrl: CalComClient.BASE_URL,
      timeoutMs: 10_000,
      defaultHeaders: { Authorization: `Bearer ${config.apiKey}` },
      fetchImpl,
    });
  }

  /**
   * Reads CAL_API_KEY and the public booking link ("username/event-slug").
   * Returns null when either is missing so routes can answer 503.
   */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): CalComClient | null {
    const apiKey = env.CAL_API_KEY?.trim();
    const [username, eventTypeSlug] = (env.NEXT_PUBLIC_CAL_LINK ?? "").trim().split("/");
    if (!apiKey || !username || !eventTypeSlug) return null;
    return new CalComClient({ apiKey, username, eventTypeSlug });
  }

  /** Available slots grouped by date in `timeZone` (inclusive date range). */
  async slots(start: string, end: string, timeZone: string): Promise<Record<string, CalSlot[]>> {
    const query = new URLSearchParams({
      username: this.config.username,
      eventTypeSlug: this.config.eventTypeSlug,
      start,
      end,
      timeZone,
      format: "range",
    });
    const response = await this.get<{ status: string; data: Record<string, CalSlot[]> }>(
      `/slots?${query}`,
      { headers: { "cal-api-version": CalComClient.SLOTS_API_VERSION } },
    );
    return response.data ?? {};
  }

  async createBooking(input: CalBookingInput): Promise<CalBooking> {
    const response = await this.post<{ status: string; data: CalBooking }>(
      "/bookings",
      {
        ...input,
        username: this.config.username,
        eventTypeSlug: this.config.eventTypeSlug,
      },
      { headers: { "cal-api-version": CalComClient.BOOKINGS_API_VERSION } },
    );
    return response.data;
  }

  /** Cal.com errors look like `{status: "error", error: {code, message}}`. */
  protected static override extractMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as { error?: { message?: unknown } | string; message?: unknown };
    if (typeof p.error === "object" && typeof p.error?.message === "string") return p.error.message;
    if (typeof p.error === "string") return p.error;
    if (typeof p.message === "string") return p.message;
    return null;
  }
}
