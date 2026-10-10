import type { NextRequest } from "next/server";

/** Checks shared by the public POST routes (booking, testimonials, resources). */
export class RequestGuard {
  /** Browsers always send Origin on cross-site POSTs; only our own pages may submit. */
  static isSameOrigin(request: NextRequest): boolean {
    const origin = request.headers.get("origin");
    if (!origin) return false;
    try {
      return new URL(origin).host === request.nextUrl.host;
    } catch {
      return false;
    }
  }

  /** First hop of x-forwarded-for (Vercel sets it), for per-IP rate limits. */
  static clientIp(request: NextRequest): string {
    return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  }
}
