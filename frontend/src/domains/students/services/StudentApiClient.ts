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

  book(body: Record<string, string | number>) {
    return this.post<CreateBookingResponse>("/api/student/book", body);
  }

  join(body: Record<string, string>) {
    return this.post<{ ok: true }>("/api/student/join", body);
  }

  /** Registration or sign-in without Google: the server emails a link (same answer either way). */
  emailLink(body: Record<string, string>) {
    return this.post<{ ok: true }>("/api/student/email-link", body);
  }

  reschedule(uid: string, start: string) {
    return this.post<CreateBookingResponse>(`/api/student/bookings/${encodeURIComponent(uid)}`, { action: "reschedule", start });
  }

  cancel(uid: string) {
    return this.post<{ uid: string; status: string }>(`/api/student/bookings/${encodeURIComponent(uid)}`, { action: "cancel" });
  }

  protected static override extractMessage(payload: unknown): string | null {
    if (payload && typeof payload === "object" && "message" in payload) {
      const { message } = payload as { message: unknown };
      if (typeof message === "string") return message;
    }
    return null;
  }
}
