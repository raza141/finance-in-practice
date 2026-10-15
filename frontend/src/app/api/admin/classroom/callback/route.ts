import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { GoogleOAuth, GoogleOAuthError } from "@/domains/admin/server/GoogleOAuth";
import { ClassroomConnection } from "@/domains/classroom/server/ClassroomConnection";
import { ClassroomSync } from "@/domains/classroom/server/ClassroomSync";

/** GET /api/admin/classroom/callback?code&state: stores the owner's Classroom grant (encrypted). */
export async function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  const finish = (notice: string) => {
    const response = NextResponse.redirect(new URL(`/admin/classroom?notice=${notice}`, origin));
    response.cookies.delete({ name: ClassroomConnection.STATE_COOKIE, path: ClassroomConnection.COOKIE_PATH });
    return response;
  };

  const admin = await AdminAuth.current();
  if (admin?.role !== "owner") return NextResponse.redirect(new URL("/admin/login", origin));
  const google = ClassroomConnection.oauth(origin);
  const store = ClassroomConnection.fromEnv();
  if (!google || !store) return finish("not-configured");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return finish("cancelled");
  const flow = GoogleOAuth.parseFlowCookie(request.cookies.get(ClassroomConnection.STATE_COOKIE)?.value);
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) return finish("expired");

  try {
    const tokens = await google.exchangeTokens(code, flow.verifier);
    // Google lets people untick boxes: without every scope the feed would be half empty.
    if (ClassroomConnection.SCOPES.some((s) => !tokens.scopes.includes(s))) return finish("missing-scopes");
    if (!tokens.refreshToken) return finish("no-refresh-token");
    await store.save(tokens.identity.email, tokens.refreshToken);
  } catch (error) {
    console.error("[classroom] connect failed", error instanceof GoogleOAuthError ? error.message : error);
    return finish("failed");
  }
  revalidateTag(ClassroomSync.TAG, { expire: 0 });
  return finish("connected");
}
