import { NextResponse, type NextRequest } from "next/server";

const LOGIN_PATH = "/admin/login";
const SESSION_COOKIE = "fip_admin_session";

/**
 * Admin routing convenience: send visitors without a session cookie to the
 * login page. It does not validate the session (that needs the database);
 * pages and server actions do that via AdminAuth.require().
 */
export function proxy(request: NextRequest) {
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  const onLogin = request.nextUrl.pathname === LOGIN_PATH;

  const response =
    !hasCookie && !onLogin ? NextResponse.redirect(new URL(LOGIN_PATH, request.url)) : NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
