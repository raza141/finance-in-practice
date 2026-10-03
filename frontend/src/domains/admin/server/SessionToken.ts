import "server-only";

import { createHash, randomBytes } from "node:crypto";

/**
 * Opaque random session tokens. The browser holds the token; the database
 * holds only its SHA-256, so a leaked sessions table can't be replayed.
 */
export class SessionToken {
  static readonly COOKIE = "fip_admin_session";
  static readonly TTL_MS = 7 * 24 * 60 * 60 * 1000;

  static generate(): string {
    return randomBytes(32).toString("base64url");
  }

  static hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  /** Cheap shape check before touching the database. */
  static isWellFormed(token: string | undefined): token is string {
    return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
  }
}
