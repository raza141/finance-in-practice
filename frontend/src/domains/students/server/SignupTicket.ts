import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Proof that a visitor just signed in with Google as `email`, carried from the
 * OAuth callback to the "finish joining" form in a short-lived signed cookie.
 * The key is derived from GOOGLE_CLIENT_SECRET, which every sign-in already needs.
 */
export class SignupTicket {
  static readonly COOKIE = "fip_student_signup";
  static readonly TTL_MS = 30 * 60 * 1000;

  constructor(private readonly key: Buffer) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): SignupTicket | null {
    const secret = env.GOOGLE_CLIENT_SECRET?.trim();
    return secret ? new SignupTicket(createHash("sha256").update(`fip-student-signup|${secret}`).digest()) : null;
  }

  issue(email: string, now: number = Date.now()): string {
    const body = Buffer.from(JSON.stringify({ email: email.toLowerCase(), exp: now + SignupTicket.TTL_MS })).toString("base64url");
    return `${body}.${this.sign(body)}`;
  }

  /** The verified email, or null when the ticket is missing, forged or expired. */
  read(value: string | undefined, now: number = Date.now()): string | null {
    const [body, signature, extra] = (value ?? "").split(".");
    if (!body || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const { email, exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as { email?: unknown; exp?: unknown };
      return typeof email === "string" && typeof exp === "number" && exp > now ? email : null;
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return createHmac("sha256", this.key).update(body).digest("base64url");
  }
}
