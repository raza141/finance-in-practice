import { NextResponse, type NextRequest } from "next/server";

import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";
import { EmailLink } from "@/domains/students/server/EmailLink";
import { OwnerNotice } from "@/domains/students/server/OwnerNotice";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentRepository } from "@/domains/students/server/StudentRepository";

/**
 * GET /api/student/auth/email?t=<EmailLink>
 * The link from our email proves the address: a registration joins (like the
 * Google "finish joining" form) and signs in; a sign-in link just signs in.
 */
export async function GET(request: NextRequest) {
  const origin = GoogleOAuth.canonicalOrigin(request.nextUrl.origin);
  const to = (path: string) => NextResponse.redirect(new URL(path, origin));

  const repo = StudentRepository.fromEnv();
  const link = EmailLink.fromEnv()?.read(request.nextUrl.searchParams.get("t"));
  if (!repo || !link) return to("/student?error=link_expired");

  try {
    if (link.kind === "register") {
      const registration = await repo.parked(link.id);
      if (!registration) return to("/student?error=link_expired");
      const { id, added } = await repo.join(registration);
      await StudentAuth.startSession(id, repo);
      const { name, email, phone, course } = registration;
      if (added) await OwnerNotice.send(`New student joined: ${name}`, "New student joined", [["Name", name], ["Email", email], ["Mobile", phone], ["Course", course], ["Signed up with", "Email link"]], id);
    } else if (link.kind === "signin") {
      const student = await repo.enrolledById(link.id);
      if (!student) return to("/student?error=link_expired");
      await StudentAuth.startSession(student.id, repo);
    } else {
      // An unsubscribe link must never sign anyone in.
      return to("/student?error=link_expired");
    }
  } catch (error) {
    console.error("[student] email link failed", error);
    return to("/student?error=link_failed");
  }
  return to("/student");
}
