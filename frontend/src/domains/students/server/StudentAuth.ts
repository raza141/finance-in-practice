import "server-only";

import { cookies } from "next/headers";

import { SessionToken } from "@/domains/admin/server/SessionToken";

import type { Student } from "../types";
import { StudentRepository } from "./StudentRepository";

/**
 * Student sessions: same opaque-token scheme as the admin (SessionToken), but
 * a separate cookie and table, so a student session can never open /admin.
 */
export class StudentAuth {
  static readonly COOKIE = "fip_student_session";
  static readonly TTL_MS = 30 * 24 * 60 * 60 * 1000;

  static async current(): Promise<Student | null> {
    const token = (await cookies()).get(StudentAuth.COOKIE)?.value;
    if (!SessionToken.isWellFormed(token)) return null;
    const repo = StudentRepository.fromEnv();
    return repo ? repo.studentBySession(SessionToken.hash(token)) : null;
  }

  static async startSession(clientId: string, repo: StudentRepository): Promise<void> {
    const token = SessionToken.generate();
    const expires = new Date(Date.now() + StudentAuth.TTL_MS);
    await repo.createSession(clientId, SessionToken.hash(token), expires);
    (await cookies()).set(StudentAuth.COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // Lax: the sign-in ends with a redirect chain from Google.
      sameSite: "lax",
      path: "/",
      expires,
    });
  }

  static async logout(): Promise<void> {
    const store = await cookies();
    const token = store.get(StudentAuth.COOKIE)?.value;
    if (SessionToken.isWellFormed(token)) await StudentRepository.fromEnv()?.deleteSession(SessionToken.hash(token));
    store.delete({ name: StudentAuth.COOKIE, path: "/" });
  }
}
