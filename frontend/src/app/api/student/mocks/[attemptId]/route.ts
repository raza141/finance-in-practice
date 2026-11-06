import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { RequestGuard } from "@/core/http/RequestGuard";
import { MockPlayerApi } from "@/domains/mocks/server/MockPlayerApi";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

const NO_STORE = { "Cache-Control": "no-store" };

function reply(body: object, status = 200) {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * POST /api/student/mocks/[attemptId]  body: { op: "save" | "pause" | "resume" | "submit" | "next" | "claim", responses?, auto?, screen? }
 *   The open player's calls (see `MockPlayerApi` for why this isn't a Server Action). The student comes
 *   from their session cookie, never the body; every read checks the attempt is theirs.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/student/mocks/[attemptId]">) {
  if (!RequestGuard.isSameOrigin(request)) return reply({ message: "Cross-origin requests are not allowed." }, 403);
  const [student, { attemptId }] = await Promise.all([StudentAuth.current(), params]);
  if (!student) return reply({ message: "Your session ended. Sign in again; your answers are kept on this device." }, 401);
  if (!MockContract.isUuid(attemptId)) return reply({ message: "Unknown attempt." }, 404);

  const call = MockPlayerApi.parse(await request.json().catch(() => null));
  if (!call) return reply({ message: "Invalid request." }, 400);

  // A page from before screens existed reads any 200 as saved: refused, it gets an error, so it shows "Not saved".
  const answer = (result: { taken?: boolean }) => (result.taken && !call.screen ? reply({ message: "This mock is open on another screen." }, 409) : reply(result));
  switch (call.op) {
    case "save":
      return answer(await MockPlayerApi.save(student.id, attemptId, call.responses, call.screen));
    case "pause":
      return answer(await MockPlayerApi.pause(student.id, attemptId, call.responses, call.screen));
    case "resume":
      return answer(await MockPlayerApi.resume(student.id, attemptId, call.screen));
    case "claim":
      return call.screen ? reply(await MockPlayerApi.claim(student.id, attemptId, call.screen)) : reply({ message: "Invalid request." }, 400);
    case "next":
      return reply(await MockPlayerApi.next(student.id, attemptId));
    case "submit": {
      const result = await MockPlayerApi.submit(student.id, attemptId, call.responses, call.auto, call.screen);
      revalidatePath("/student");
      return reply(result);
    }
  }
}
