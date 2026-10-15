import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { Database, type Sql } from "@/core/db/Database";
import { GoogleOAuth } from "@/domains/admin/server/GoogleOAuth";

/**
 * The owner's read-only link to their Google Classroom (041_classroom_sync).
 * Its own Google Cloud project (CLASSROOM_CLIENT_ID / _SECRET), so students
 * signing in never see the "unverified app" screen these scopes bring. The
 * refresh token is stored AES-256-GCM encrypted with a key derived from the
 * client secret: a database leak alone doesn't expose it.
 */
export class ClassroomConnection {
  static readonly SCOPES = [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.students.readonly",
    "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
    "https://www.googleapis.com/auth/classroom.announcements.readonly",
    "https://www.googleapis.com/auth/classroom.topics.readonly",
    "https://www.googleapis.com/auth/classroom.rosters.readonly",
    "https://www.googleapis.com/auth/classroom.profile.emails",
  ] as const;
  /** Older names Google may report for the same grant (the console shows "student-submissions"). */
  static readonly ALIASES: Readonly<Record<string, string>> = {
    "https://www.googleapis.com/auth/classroom.coursework.students.readonly": "https://www.googleapis.com/auth/classroom.student-submissions.students.readonly",
  };
  static readonly CALLBACK_PATH = "/api/admin/classroom/callback";
  static readonly STATE_COOKIE = "fip_classroom_oauth";
  static readonly COOKIE_PATH = "/api/admin/classroom";

  constructor(
    private readonly sql: Sql,
    private readonly key: Buffer,
  ) {}

  /** The scopes we need that aren't in `granted` (either name counts). */
  static missing(granted: readonly string[]): string[] {
    return ClassroomConnection.SCOPES.filter((s) => !granted.includes(s) && !granted.includes(ClassroomConnection.ALIASES[s] ?? ""));
  }

  static credentials(env: NodeJS.ProcessEnv = process.env): { id: string; secret: string } | null {
    const id = env.CLASSROOM_CLIENT_ID?.trim();
    const secret = env.CLASSROOM_CLIENT_SECRET?.trim();
    return id && secret ? { id, secret } : null;
  }

  static oauth(origin: string): GoogleOAuth | null {
    const c = ClassroomConnection.credentials();
    return c
      ? new GoogleOAuth(c.id, c.secret, origin, ClassroomConnection.CALLBACK_PATH, undefined, { scopes: ClassroomConnection.SCOPES, offline: true })
      : null;
  }

  static fromEnv(): ClassroomConnection | null {
    const sql = Database.sql();
    const c = ClassroomConnection.credentials();
    return sql && c ? new ClassroomConnection(sql, createHash("sha256").update(`fip-classroom-token|${c.secret}`).digest()) : null;
  }

  async save(email: string, refreshToken: string): Promise<void> {
    const sealed = this.seal(refreshToken);
    await this.sql`
      INSERT INTO classroom_connection (id, google_email, refresh_token) VALUES (1, ${email}, ${sealed})
      ON CONFLICT (id) DO UPDATE SET google_email = EXCLUDED.google_email, refresh_token = EXCLUDED.refresh_token, connected_at = now()
    `;
  }

  /** Who is connected and the decrypted token; token null if it can't be read (e.g. the secret was rotated). */
  async current(): Promise<{ email: string; connectedAt: string; refreshToken: string | null } | null> {
    const [row] = (await this.sql`SELECT google_email, refresh_token, connected_at FROM classroom_connection WHERE id = 1`) as {
      google_email: string;
      refresh_token: string;
      connected_at: Date;
    }[];
    return row ? { email: row.google_email, connectedAt: new Date(row.connected_at).toISOString(), refreshToken: this.open(row.refresh_token) } : null;
  }

  async remove(): Promise<void> {
    await this.sql`DELETE FROM classroom_connection WHERE id = 1`;
  }

  private seal(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
  }

  private open(sealed: string): string | null {
    try {
      const [iv, tag, data] = sealed.split(".").map((p) => Buffer.from(p, "base64url"));
      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    } catch {
      return null;
    }
  }
}
