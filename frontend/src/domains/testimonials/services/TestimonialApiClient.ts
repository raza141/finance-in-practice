import { BaseApiClient, type ApiClientOptions, type RequestOptions } from "@/core/http/BaseApiClient";

import type { SubmitTestimonialRequest, SubmitTestimonialResponse } from "./TestimonialContract";

/** Browser client for our own `/api/testimonials` route (same origin). */
export class TestimonialApiClient extends BaseApiClient {
  constructor(options: Partial<ApiClientOptions> = {}) {
    super({ baseUrl: "", timeoutMs: 15_000, ...options });
  }

  submit(body: SubmitTestimonialRequest, options?: RequestOptions) {
    return this.post<SubmitTestimonialResponse>("/api/testimonials", body, options);
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
