export type ApiErrorKind =
  | "timeout"
  | "aborted"
  | "network"
  | "validation"
  | "rate_limited"
  | "http"
  | "parse";

/** A normalised failure from any `BaseApiClient` subclass. */
export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly status: number | null = null,
    readonly detail: unknown = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isRetryable(): boolean {
    return this.kind === "timeout" || this.kind === "network" || this.kind === "rate_limited";
  }
}
