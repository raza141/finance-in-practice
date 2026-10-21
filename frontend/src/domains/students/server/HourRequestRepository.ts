import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { HourRequest, HourRequestStatus } from "../types";

interface RequestRow {
  id: string;
  agreement_id: string;
  month: string;
  hours: string;
  note: string;
  status: HourRequestStatus;
  created_at: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Asks for more hours on a monthly allowance (050_allowances_terms). Every write is scoped to the client. */
export class HourRequestRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): HourRequestRepository | null {
    const sql = Database.sql();
    return sql ? new HourRequestRepository(sql) : null;
  }

  /** Newest first. */
  async forClient(clientId: string): Promise<HourRequest[]> {
    if (!UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT id, agreement_id, month, hours, note, status, created_at FROM hour_requests
      WHERE client_id = ${clientId} ORDER BY created_at DESC LIMIT 200
    `) as RequestRow[];
    return rows.map((r) => ({
      id: r.id,
      agreementId: r.agreement_id,
      month: r.month,
      hours: Number(r.hours),
      note: r.note,
      status: r.status,
      createdAt: r.created_at,
    }));
  }

  /** False when one is already waiting for that agreement and month, or the agreement isn't theirs and live. */
  async create(clientId: string, agreementId: string, month: string, hours: number, note: string): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(agreementId)) return false;
    const rows = await this.sql`
      INSERT INTO hour_requests (client_id, agreement_id, month, hours, note)
      SELECT ${clientId}, ${agreementId}, ${month}, ${hours}, ${note}
      WHERE EXISTS (SELECT 1 FROM client_agreements WHERE id = ${agreementId} AND client_id = ${clientId} AND archived_at IS NULL)
      ON CONFLICT (agreement_id, month) WHERE status = 'pending' DO NOTHING
      RETURNING id
    `;
    return rows.length > 0;
  }

  /** The owner's answer to a waiting request. */
  async decide(clientId: string, id: string, status: Exclude<HourRequestStatus, "pending">): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE hour_requests SET status = ${status}, decided_at = now()
      WHERE id = ${id} AND client_id = ${clientId} AND status = 'pending' RETURNING id
    `;
    return rows.length > 0;
  }
}
