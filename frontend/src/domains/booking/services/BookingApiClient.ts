import { BaseApiClient, type ApiClientOptions, type RequestOptions } from "@/core/http/BaseApiClient";

import type {
  CreateBookingRequest,
  CreateBookingResponse,
  DaySlotsResponse,
  RangeSlotsResponse,
} from "./BookingContract";

/** Browser client for our own `/api/booking/*` routes (same origin). */
export class BookingApiClient extends BaseApiClient {
  constructor(options: Partial<ApiClientOptions> = {}) {
    super({ baseUrl: "", timeoutMs: 15_000, ...options });
  }

  day(date: string, timeZone: string, options?: RequestOptions) {
    const query = new URLSearchParams({ date, timeZone });
    return this.get<DaySlotsResponse>(`/api/booking/slots?${query}`, options);
  }

  range(start: string, end: string, timeZone: string, options?: RequestOptions) {
    const query = new URLSearchParams({ start, end, timeZone });
    return this.get<RangeSlotsResponse>(`/api/booking/slots?${query}`, options);
  }

  create(body: CreateBookingRequest, options?: RequestOptions) {
    return this.post<CreateBookingResponse>("/api/booking/create", body, options);
  }

  /** Our routes answer errors as `{ error: CODE, message }`. */
  protected static override extractMessage(payload: unknown): string | null {
    if (payload && typeof payload === "object" && "message" in payload) {
      const { message } = payload as { message: unknown };
      if (typeof message === "string") return message;
    }
    return null;
  }
}
