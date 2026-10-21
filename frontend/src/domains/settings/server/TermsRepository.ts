import "server-only";

import { Database, type Sql } from "@/core/db/Database";

export interface TermsVersion {
  id: string;
  body: string;
  createdAt: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Published versions of the terms and conditions (050_allowances_terms). The
 * newest is live on /terms; older ones stay, so each acceptance points at the
 * exact text a student agreed to. None yet: /terms shows the built-in text.
 */
export class TermsRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): TermsRepository | null {
    const sql = Database.sql();
    return sql ? new TermsRepository(sql) : null;
  }

  async latest(): Promise<TermsVersion | null> {
    const [row] = (await this.sql`SELECT id, body, created_at FROM site_terms ORDER BY created_at DESC LIMIT 1`) as { id: string; body: string; created_at: Date }[];
    return row ? { id: row.id, body: row.body, createdAt: row.created_at } : null;
  }

  async publish(body: string, adminId: string): Promise<void> {
    await this.sql`INSERT INTO site_terms (body, created_by) VALUES (${body}, ${UUID.test(adminId) ? adminId : null})`;
  }

  /** Whether a client accepted the live version (any acceptance counts while no version is published). */
  async acceptedCurrent(clientId: string): Promise<boolean> {
    if (!UUID.test(clientId)) return false;
    const [row] = (await this.sql`
      SELECT c.terms_accepted_at IS NOT NULL
        AND (c.terms_version IS NOT DISTINCT FROM (SELECT id FROM site_terms ORDER BY created_at DESC LIMIT 1)) AS ok
      FROM clients c WHERE c.id = ${clientId}
    `) as { ok: boolean }[];
    return row?.ok ?? false;
  }

  /** Records that a client accepted the live version now. */
  async accept(clientId: string): Promise<void> {
    if (!UUID.test(clientId)) return;
    await this.sql`
      UPDATE clients SET terms_accepted_at = now(), terms_version = (SELECT id FROM site_terms ORDER BY created_at DESC LIMIT 1) WHERE id = ${clientId}
    `;
  }
}
