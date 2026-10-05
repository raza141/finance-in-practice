import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { BookingBlock, TimeRange } from "../types";

interface BlockRow {
  id: string;
  starts_at: Date;
  ends_at: Date;
  reason: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Time blocked from the admin Schedule page. Schema: 011_booking_blocks. */
export class BlockRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): BlockRepository | null {
    const sql = Database.sql();
    return sql ? new BlockRepository(sql) : null;
  }

  /** Blocks overlapping [from, to). */
  async between(from: string, to: string): Promise<BookingBlock[]> {
    const rows = (await this.sql`
      SELECT id, starts_at, ends_at, reason FROM booking_blocks
      WHERE starts_at < ${to} AND ends_at > ${from}
      ORDER BY starts_at
    `) as BlockRow[];
    return rows.map((r) => ({ id: r.id, start: r.starts_at.toISOString(), end: r.ends_at.toISOString(), reason: r.reason }));
  }

  async create(range: TimeRange, reason: string, userId: string): Promise<void> {
    await this.sql`
      INSERT INTO booking_blocks (starts_at, ends_at, reason, created_by)
      VALUES (${range.start}, ${range.end}, ${reason}, ${userId})
    `;
  }

  async remove(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`DELETE FROM booking_blocks WHERE id = ${id}`;
  }
}
