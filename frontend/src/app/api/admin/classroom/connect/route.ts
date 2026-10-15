import { NextResponse, type NextRequest } from "next/server";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";
import { ClassroomConnection } from "@/domains/classroom/server/ClassroomConnection";

/** GET /api/admin/classroom/connect: the owner grants read-only Classroom access. */
export async function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  if (request.nextUrl.origin !== origin) return NextResponse.redirect(new URL(request.nextUrl.pathname, origin));
  const admin = await AdminAuth.current();
  if (admin?.role !== "owner") return NextResponse.redirect(new URL("/admin/login", origin));

  const google = ClassroomConnection.oauth(origin);
  if (!google) return NextResponse.redirect(new URL("/admin/classroom?notice=not-configured", origin));
  const flow = GoogleOAuth.newFlow();
  const response = NextResponse.redirect(google.authorizationUrl(flow.state, flow.verifier));
  response.cookies.set(ClassroomConnection.STATE_COOKIE, flow.cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: ClassroomConnection.COOKIE_PATH,
    maxAge: GoogleOAuth.STATE_TTL_S,
  });
  return response;
}
