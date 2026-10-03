import { NextResponse, type NextRequest } from "next/server";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminRepository } from "@/domains/admin/server/AdminRepository";
import { GoogleOAuth, GoogleOAuthError } from "@/domains/admin/server/GoogleOAuth";

/**
 * GET /api/admin/auth/google/callback?code&state
 * Signs in only Google accounts whose email is on the admin allowlist.
 */
export async function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  const fail = (error: string) => {
    const response = NextResponse.redirect(new URL(`/admin/login?error=${error}`, origin));
    response.cookies.delete({ name: GoogleOAuth.STATE_COOKIE, path: "/api/admin/auth/google" });
    return response;
  };

  const google = GoogleOAuth.fromEnv(origin);
  const repo = AdminRepository.fromEnv();
  if (!google || !repo) return fail("google_unavailable");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("google_cancelled");

  const flow = GoogleOAuth.parseFlowCookie(request.cookies.get(GoogleOAuth.STATE_COOKIE)?.value);
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) return fail("google_state");

  try {
    const identity = await google.exchange(code, flow.verifier);
    const admin = await repo.findOrLinkGoogle(identity.sub, identity.email);
    if (!admin) {
      console.warn("[admin] Google sign-in refused for a non-allowlisted account");
      return fail("not_authorised");
    }
    await AdminAuth.startSession(admin.id, repo);
  } catch (error) {
    console.error("[admin] Google sign-in failed", error instanceof GoogleOAuthError ? error.message : error);
    return fail("google_failed");
  }

  const response = NextResponse.redirect(new URL("/admin", origin));
  response.cookies.delete({ name: GoogleOAuth.STATE_COOKIE, path: "/api/admin/auth/google" });
  return response;
}
