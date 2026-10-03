import { NextResponse, type NextRequest } from "next/server";

import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";

/** GET /api/admin/auth/google: start "Sign in with Google". */
export function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  // Start on the registered host, so the state cookie is readable by the callback.
  if (request.nextUrl.origin !== origin) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname, origin));
  }

  const google = GoogleOAuth.fromEnv(origin);
  if (!google) return NextResponse.redirect(new URL("/admin/login?error=google_unavailable", origin));

  const flow = GoogleOAuth.newFlow();
  const response = NextResponse.redirect(google.authorizationUrl(flow.state, flow.verifier));
  response.cookies.set(GoogleOAuth.STATE_COOKIE, flow.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Lax so the cookie survives Google's top-level redirect back to us.
    sameSite: "lax",
    path: "/api/admin/auth/google",
    maxAge: GoogleOAuth.STATE_TTL_S,
  });
  return response;
}
