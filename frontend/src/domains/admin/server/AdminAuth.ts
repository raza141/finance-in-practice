import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";

import type { AdminUser } from "../types";
import { AdminRepository } from "./AdminRepository";
import { PasswordHasher } from "./PasswordHasher";
import { SessionToken } from "./SessionToken";

export type AuthResult = { ok: true } | { ok: false; message: string };

const INVALID_LOGIN = "Incorrect email or password.";

/**
 * Request-scoped admin authentication backed by database sessions. Every
 * admin page and server action calls `require()` itself: the proxy redirect
 * is a convenience, not the security boundary.
 */
export class AdminAuth {
  // Per warm instance: 10 attempts per IP and 5 per email, each per 15 minutes.
  private static readonly ipLimiter = new SlidingWindowRateLimiter(10, 15 * 60_000);
  private static readonly emailLimiter = new SlidingWindowRateLimiter(5, 15 * 60_000);

  /** The signed-in admin, or null. Reads the cookie first so admin pages always render per request. */
  static async current(): Promise<AdminUser | null> {
    const token = (await cookies()).get(SessionToken.COOKIE)?.value;
    if (!SessionToken.isWellFormed(token)) return null;
    const repo = AdminRepository.fromEnv();
    return repo ? repo.userBySession(SessionToken.hash(token)) : null;
  }

  /** The signed-in admin; redirects to the login page otherwise. */
  static async require(): Promise<AdminUser> {
    const admin = await AdminAuth.current();
    if (!admin) redirect("/admin/login");
    return admin;
  }

  static async loginWithPassword(email: string, password: string): Promise<AuthResult> {
    const repo = AdminRepository.fromEnv();
    if (!repo) return { ok: false, message: "Admin login is unavailable: the database is not configured." };

    const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const normalised = email.trim().toLowerCase();
    if (!AdminAuth.ipLimiter.allow(ip) || !AdminAuth.emailLimiter.allow(normalised)) {
      return { ok: false, message: "Too many attempts. Please wait 15 minutes." };
    }

    const credentials = await repo.credentialsByEmail(normalised);
    // Always run a hash comparison, so response time doesn't reveal unknown emails.
    const valid = await PasswordHasher.verify(password, credentials?.passwordHash ?? null);
    if (!credentials || !valid) return { ok: false, message: INVALID_LOGIN };

    await AdminAuth.startSession(credentials.user.id);
    return { ok: true };
  }

  /** Issue a session cookie for an already-authenticated admin (password or Google). */
  static async startSession(userId: string, repo = AdminRepository.fromEnv()): Promise<void> {
    if (!repo) throw new Error("DATABASE_URL is not configured");
    const token = SessionToken.generate();
    const expires = new Date(Date.now() + SessionToken.TTL_MS);
    await repo.createSession(userId, SessionToken.hash(token), expires);
    (await cookies()).set(SessionToken.COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // Lax, not Strict: the Google sign-in ends with a cross-site redirect
      // chain, and Strict would drop the cookie on the final hop to /admin.
      sameSite: "lax",
      path: "/",
      expires,
    });
  }

  static async logout(): Promise<void> {
    const store = await cookies();
    const token = store.get(SessionToken.COOKIE)?.value;
    if (SessionToken.isWellFormed(token)) await AdminRepository.fromEnv()?.deleteSession(SessionToken.hash(token));
    store.delete({ name: SessionToken.COOKIE, path: "/" });
  }

  /** Set or change the signed-in admin's password; signs out their other sessions. */
  static async changePassword(current: string, next: string): Promise<AuthResult> {
    const admin = await AdminAuth.require();
    const repo = AdminRepository.fromEnv();
    if (!repo) return { ok: false, message: "The database is not configured." };

    const weakness = PasswordHasher.weakness(next);
    if (weakness) return { ok: false, message: weakness };

    const existing = await repo.passwordHash(admin.id);
    if (existing && !(await PasswordHasher.verify(current, existing))) {
      return { ok: false, message: "Current password is incorrect." };
    }

    await repo.setPassword(admin.id, await PasswordHasher.hash(next));
    const token = (await cookies()).get(SessionToken.COOKIE)?.value ?? "";
    await repo.deleteOtherSessions(admin.id, SessionToken.hash(token));
    return { ok: true };
  }
}
