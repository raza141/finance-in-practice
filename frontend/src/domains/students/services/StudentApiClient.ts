import { BaseApiClient, type ApiClientOptions } from "@/core/http/BaseApiClient";
import type { CreateBookingResponse, RangeSlotsResponse } from "@/domains/booking/services/BookingContract";

/** Browser client for `/api/student/*` (same origin, student cookie). */
export class StudentApiClient extends BaseApiClient {
  constructor(options: Partial<ApiClientOptions> = {}) {
    super({ baseUrl: "", timeoutMs: 15_000, ...options });
  }

  slots(start: string, end: string, timeZone: string) {
    return this.get<RangeSlotsResponse>(`/api/student/slots?${new URLSearchParams({ start, end, timeZone })}`);
  }

  book(body: Record<string, string>) {
    return this.post<CreateBookingResponse>("/api/student/book", body);
  }

  protected static override extractMessage(payload: unknown): string | null {
    if (payload && typeof payload === "object" && "message" in payload) {
      const { message } = payload as { message: unknown };
      if (typeof message === "string") return message;
    }
    return null;
  }
}
