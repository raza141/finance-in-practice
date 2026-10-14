import { NextResponse, type NextRequest } from "next/server";

import { GoogleOAuth, GoogleOAuthError } from "@/domains/admin/server/GoogleOAuth";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentOAuth } from "@/domains/students/server/StudentOAuth";
import { SignupTicket } from "@/domains/students/server/SignupTicket";
import { StudentRepository } from "@/domains/students/server/StudentRepository";

/**
 * GET /api/student/auth/google/callback?code&state
 * Signs in Google accounts whose email belongs to a client with a course. Anyone
 * else gets a short-lived signed ticket for that verified email and is sent to
 * the "finish joining" form (/student?view=join), which enrols them at once.
 */
export async function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  const finish = (path: string) => {
    const response = NextResponse.redirect(new URL(path, origin));
    response.cookies.delete({ name: StudentOAuth.STATE_COOKIE, path: StudentOAuth.COOKIE_PATH });
    return response;
  };
  const fail = (error: string) => finish(`/student?error=${error}`);

  const google = StudentOAuth.client(origin);
  const repo = StudentRepository.fromEnv();
  if (!google || !repo) return fail("google_unavailable");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return fail("google_cancelled");

  const flow = GoogleOAuth.parseFlowCookie(request.cookies.get(StudentOAuth.STATE_COOKIE)?.value);
  const code = params.get("code");
  if (!flow || !code || params.get("state") !== flow.state) return fail("google_state");

  try {
    const identity = await google.exchange(code, flow.verifier);
    const student = await repo.enrolledByEmail(identity.email);
    if (!student) {
      const tickets = SignupTicket.fromEnv();
      if (!tickets) return fail("not_enrolled");
      const response = finish("/student?view=join");
      response.cookies.set(SignupTicket.COOKIE, tickets.issue(identity.email), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SignupTicket.TTL_MS / 1000,
      });
      return response;
    }
    await StudentAuth.startSession(student.id, repo);
  } catch (error) {
    console.error("[student] Google sign-in failed", error instanceof GoogleOAuthError ? error.message : error);
    return fail("google_failed");
  }
  return finish("/student");
}
