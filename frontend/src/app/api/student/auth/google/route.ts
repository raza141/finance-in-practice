import { NextResponse, type NextRequest } from "next/server";

import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";
import { StudentOAuth } from "@/domains/students/server/StudentOAuth";

/** GET /api/student/auth/google: start the student "Sign in with Google". */
export function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  if (request.nextUrl.origin !== origin) {
    return NextResponse.redirect(new URL(request.nextUrl.pathname, origin));
  }

  const google = StudentOAuth.client(origin);
  if (!google) return NextResponse.redirect(new URL("/student?error=google_unavailable", origin));

  const flow = GoogleOAuth.newFlow();
  const response = NextResponse.redirect(google.authorizationUrl(flow.state, flow.verifier));
  response.cookies.set(StudentOAuth.STATE_COOKIE, flow.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: StudentOAuth.COOKIE_PATH,
    maxAge: GoogleOAuth.STATE_TTL_S,
  });
  return response;
}
