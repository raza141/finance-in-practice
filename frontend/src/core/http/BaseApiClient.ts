import { ApiError } from "./ApiError";

export interface ApiClientOptions {
  /** Origin (and optional path prefix) every request path is appended to. */
  baseUrl: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
  /** Injected for tests; defaults to the global `fetch`. */
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Typed JSON-over-HTTP client. Subclasses expose domain methods and call the
 * protected verbs; all transport concerns (timeouts, cancellation, error
 * normalisation) live here.
 */
export abstract class BaseApiClient {
  static readonly DEFAULT_TIMEOUT_MS = 15_000;

  protected readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;
  private readonly fetchImpl: typeof fetch;

  protected constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? BaseApiClient.DEFAULT_TIMEOUT_MS;
    this.defaultHeaders = { Accept: "application/json", ...options.defaultHeaders };
    this.fetchImpl = options.fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
  }

  protected get<TResponse>(path: string, options?: RequestOptions): Promise<TResponse> {
    return this.request<TResponse>("GET", path, undefined, options);
  }

  protected post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options?: RequestOptions,
  ): Promise<TResponse> {
    return this.request<TResponse>("POST", path, body, options);
  }

  private async request<TResponse>(
    method: HttpMethod,
    path: string,
    body: unknown,
    options: RequestOptions = {},
  ): Promise<TResponse> {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), options.timeoutMs ?? this.timeoutMs);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout.signal])
      : timeout.signal;

    let response: Response;
    try {
      response = await this.fetchImpl(this.url(path), {
        method,
        signal,
        headers: {
          ...this.defaultHeaders,
          ...(body !== undefined && { "Content-Type": "application/json" }),
          ...options.headers,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw this.transportError(error, timeout.signal, options.signal);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) throw await this.httpError(response);
    if (response.status === 204) return undefined as TResponse;

    try {
      return (await response.json()) as TResponse;
    } catch {
      throw new ApiError("parse", "Response was not valid JSON", response.status);
    }
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private transportError(
    error: unknown,
    timeoutSignal: AbortSignal,
    callerSignal?: AbortSignal,
  ): ApiError {
    if (callerSignal?.aborted) return new ApiError("aborted", "Request was cancelled");
    if (timeoutSignal.aborted) return new ApiError("timeout", "Request timed out");
    const reason = error instanceof Error ? error.message : String(error);
    return new ApiError("network", `Network error: ${reason}`);
  }

  private async httpError(response: Response): Promise<ApiError> {
    const payload = await response.json().catch(() => null);
    // Resolved through the subclass so each API can describe its own error shape.
    const extract = (this.constructor as typeof BaseApiClient).extractMessage;
    const message = extract(payload) ?? response.statusText;

    if (response.status === 422 || response.status === 400) {
      return new ApiError("validation", message, response.status, payload);
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      return new ApiError(
        "rate_limited",
        "Too many requests. Please wait and try again.",
        429,
        payload,
        Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      );
    }
    return new ApiError("http", message || `HTTP ${response.status}`, response.status, payload);
  }

  /**
   * FastAPI returns either `{detail: "message"}` (domain errors) or
   * `{detail: [{loc, msg}, ...]}` (request validation errors).
   */
  protected static extractMessage(payload: unknown): string | null {
    if (!payload || typeof payload !== "object" || !("detail" in payload)) return null;
    const { detail } = payload as { detail: unknown };
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item: { loc?: unknown[]; msg?: string }) => {
          const field = item.loc?.filter((part) => part !== "body").join(".");
          return field ? `${field}: ${item.msg}` : item.msg;
        })
        .filter(Boolean)
        .join("; ");
    }
    return null;
  }
}
