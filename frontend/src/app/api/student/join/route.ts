import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

import { RequestGuard } from "@/core/http/RequestGuard";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { OwnerNotice } from "@/domains/students/server/OwnerNotice";
import { SignupTicket } from "@/domains/students/server/SignupTicket";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentRepository } from "@/domains/students/server/StudentRepository";
import { Batches } from "@/domains/students/services/Batches";
import { PackageTable } from "@/domains/packages/services/PackageTable";
import { RegistrationContract } from "@/domains/students/services/RegistrationContract";

const NO_STORE = { "Cache-Control": "no-store" };

// 5 joins per client IP per hour (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 60 * 60_000);

function reject(status: number, message: string) {
  return Response.json({ message }, { status, headers: NO_STORE });
}

/**
 * POST /api/student/join  body: { name, phone, course, topic? }
 *   Needs the signed ticket the Google callback set: the email comes from
 *   Google, never the body. Enrols the student and signs them in.
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many requests. Please try again later.");

  const store = await cookies();
  const email = SignupTicket.fromEnv()?.read(store.get(SignupTicket.COOKIE)?.value);
  if (!email) return reject(401, "Your Google sign-in expired. Please continue with Google again.");

  const repo = StudentRepository.fromEnv();
  const classrooms = ClassroomRepository.fromEnv();
  if (!repo || !classrooms) return reject(503, "Joining is not available right now. Please message us on WhatsApp.");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return reject(400, "Invalid request.");
  }

  try {
    const { titles, batches, packages, groups } = await classrooms.registrationOptions();
    const parsed = RegistrationContract.parse({ ...(payload as object), email }, titles, batches, packages, groups);
    if (!parsed.ok) return reject(400, parsed.error);
    if (parsed.spam) return reject(400, "Unable to process this request.");
    const { id: clientId, package: chosen } = await repo.join(parsed.value);
    await StudentAuth.startSession(clientId, repo);
    store.delete({ name: SignupTicket.COOKIE, path: "/" });
    const { name, email: joined, phone, course, batch } = parsed.value;
    const batchRow = batch ? [Batches.noticeRow(batch, await classrooms.batchState(course, batch))] : [];
    await OwnerNotice.send(`New student joined: ${name}`, "New student joined", [["Name", name], ["Email", joined], ["Mobile", phone], ["Course", course], ...batchRow, ...PackageTable.noticeRows(chosen)], clientId);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    console.error("[join] could not enrol", error);
    return reject(500, "Something went wrong. Please retry shortly.");
  }
}
