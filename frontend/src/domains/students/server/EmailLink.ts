import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** "register": a pending row in student_registrations. "signin": an enrolled client. "unsubscribe": stop the weekly email (never signs in). */
export type EmailLinkKind = "register" | "signin" | "unsubscribe";
const KINDS: readonly string[] = ["register", "signin", "unsubscribe"];

/**
 * The link we email to prove a typed address belongs to the visitor (no Google).
 * Carries only an id, never a name or number, so nothing personal lands in URLs
 * or logs. Signed with a key derived from GOOGLE_CLIENT_SECRET (own label, so a
 * SignupTicket can't pass as one).
 * ponytail: reusable until it expires (mail scanners open links first); add a used-at column if single-use matters.
 */
export class EmailLink {
  static readonly TTL_MS = 30 * 60 * 1000;
  static readonly PATH = "/api/student/auth/email";
  /** Unsubscribe links sit in old emails, so they last longer; they can only switch the email off. */
  static readonly UNSUBSCRIBE_TTL_MS = 60 * 24 * 60 * 60 * 1000;

  constructor(private readonly key: Buffer) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): EmailLink | null {
    const secret = env.GOOGLE_CLIENT_SECRET?.trim();
    return secret ? new EmailLink(createHash("sha256").update(`fip-student-email-link|${secret}`).digest()) : null;
  }

  issue(kind: EmailLinkKind, id: string, now: number = Date.now()): string {
    const ttl = kind === "unsubscribe" ? EmailLink.UNSUBSCRIBE_TTL_MS : EmailLink.TTL_MS;
    const body = Buffer.from(JSON.stringify({ kind, id, exp: now + ttl })).toString("base64url");
    return `${body}.${this.sign(body)}`;
  }

  url(origin: string, kind: EmailLinkKind, id: string): string {
    return `${origin}${kind === "unsubscribe" ? "/student/weekly-email" : EmailLink.PATH}?t=${this.issue(kind, id)}`;
  }

  /** The kind and id, or null when the token is missing, forged or expired. */
  read(value: string | null | undefined, now: number = Date.now()): { kind: EmailLinkKind; id: string } | null {
    const [body, signature, extra] = (value ?? "").split(".");
    if (!body || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const { kind, id, exp } = JSON.parse(Buffer.from(body, "base64url").toString()) as Record<string, unknown>;
      if (typeof kind !== "string" || !KINDS.includes(kind) || typeof id !== "string" || typeof exp !== "number" || exp <= now) return null;
      return { kind: kind as EmailLinkKind, id };
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return createHmac("sha256", this.key).update(body).digest("base64url");
  }
}
