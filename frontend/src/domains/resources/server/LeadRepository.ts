import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { LeadRequest } from "../services/LeadContract";

export interface Lead {
  id: string;
  email: string;
  resourceId: string;
  source: string;
  marketingOptIn: boolean;
  requests: number;
  createdAt: Date;
  lastRequestedAt: Date;
}

interface LeadRow {
  id: string;
  email: string;
  resource_id: string;
  source: string;
  marketing_opt_in: boolean;
  requests: number;
  created_at: Date;
  last_requested_at: Date;
}

/** Postgres-backed lead store (migration 033_leads). */
export class LeadRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): LeadRepository | null {
    const sql = Database.sql();
    return sql ? new LeadRepository(sql) : null;
  }

  /** Insert, or count a repeat request; opt-in only ever turns on. */
  async save(lead: Pick<LeadRequest, "email" | "source" | "marketingOptIn"> & { resourceId: string }): Promise<void> {
    await this.sql`
      INSERT INTO leads (email, resource_id, source, marketing_opt_in)
      VALUES (${lead.email}, ${lead.resourceId}, ${lead.source}, ${lead.marketingOptIn})
      ON CONFLICT (email, resource_id) DO UPDATE
        SET requests = leads.requests + 1,
            last_requested_at = now(),
            marketing_opt_in = leads.marketing_opt_in OR EXCLUDED.marketing_opt_in
    `;
  }

  async recent(limit = 500): Promise<Lead[]> {
    const rows = (await this.sql`
      SELECT id, email, resource_id, source, marketing_opt_in, requests, created_at, last_requested_at
      FROM leads ORDER BY created_at DESC LIMIT ${limit}
    `) as LeadRow[];
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      resourceId: r.resource_id,
      source: r.source,
      marketingOptIn: r.marketing_opt_in,
      requests: r.requests,
      createdAt: r.created_at,
      lastRequestedAt: r.last_requested_at,
    }));
  }
}
