import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { AdminRole, AdminUser } from "../types";

/** Row needed to check a password; the hash never leaves the server layer. */
export interface AdminCredentials {
  user: AdminUser;
  passwordHash: string | null;
}

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  password_hash: string | null;
  google_sub: string | null;
}

/** Admin allowlist and sessions. Schema: scripts/db/migrate.mts (002_admin_auth). */
export class AdminRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): AdminRepository | null {
    const sql = Database.sql();
    return sql ? new AdminRepository(sql) : null;
  }

  async credentialsByEmail(email: string): Promise<AdminCredentials | null> {
    const [row] = (await this.sql`
      SELECT id, email, name, role, password_hash, google_sub
      FROM admin_users WHERE email = ${email.toLowerCase()} AND active
    `) as AdminRow[];
    return row ? { user: AdminRepository.toUser(row), passwordHash: row.password_hash } : null;
  }

  async passwordHash(userId: string): Promise<string | null> {
    const [row] = (await this.sql`SELECT password_hash FROM admin_users WHERE id = ${userId}`) as AdminRow[];
    return row?.password_hash ?? null;
  }

  /**
   * Resolve a verified Google identity against the allowlist. A linked
   * account matches on its stable subject id; otherwise an active admin with
   * the same email is linked to it on this first sign-in.
   */
  async findOrLinkGoogle(sub: string, email: string): Promise<AdminUser | null> {
    const [linked] = (await this.sql`
      SELECT id, email, name, role, password_hash, google_sub
      FROM admin_users WHERE google_sub = ${sub} AND active
    `) as AdminRow[];
    if (linked) return AdminRepository.toUser(linked);

    const [row] = (await this.sql`
      UPDATE admin_users SET google_sub = ${sub}
      WHERE email = ${email.toLowerCase()} AND active AND google_sub IS NULL
      RETURNING id, email, name, role, password_hash, google_sub
    `) as AdminRow[];
    return row ? AdminRepository.toUser(row) : null;
  }

  async setPassword(userId: string, passwordHash: string): Promise<void> {
    await this.sql`UPDATE admin_users SET password_hash = ${passwordHash} WHERE id = ${userId}`;
  }

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.sql.transaction([
      this.sql`DELETE FROM admin_sessions WHERE expires_at < now()`,
      this.sql`INSERT INTO admin_sessions (token_hash, user_id, expires_at)
               VALUES (${tokenHash}, ${userId}, ${expiresAt.toISOString()})`,
      this.sql`UPDATE admin_users SET last_login_at = now() WHERE id = ${userId}`,
    ]);
  }

  /** The admin owning an unexpired session, if that admin is still active. */
  async userBySession(tokenHash: string): Promise<AdminUser | null> {
    const [row] = (await this.sql`
      SELECT u.id, u.email, u.name, u.role, u.password_hash, u.google_sub
      FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.token_hash = ${tokenHash} AND s.expires_at > now() AND u.active
    `) as AdminRow[];
    return row ? AdminRepository.toUser(row) : null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
  }

  /** Sign out everywhere except the given session (e.g. after a password change). */
  async deleteOtherSessions(userId: string, keepTokenHash: string): Promise<void> {
    await this.sql`DELETE FROM admin_sessions WHERE user_id = ${userId} AND token_hash <> ${keepTokenHash}`;
  }

  private static toUser(row: AdminRow): AdminUser {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      hasPassword: row.password_hash !== null,
      googleLinked: row.google_sub !== null,
    };
  }
}
