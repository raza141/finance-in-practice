import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { SessionLogEntry, SessionLogInput } from "../types";

interface LogRow {
  id: string;
  booking_uid: string | null;
  on_date: string | null;
  minutes: number;
  note: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The owner's record of time actually studied. Schema: 049_session_log. Every write is scoped to the client. */
export class SessionLogRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): SessionLogRepository | null {
    const sql = Database.sql();
    return sql ? new SessionLogRepository(sql) : null;
  }

  /** Hand-logged sessions newest first, then booking corrections. */
  async forClient(clientId: string): Promise<SessionLogEntry[]> {
    if (!UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT id, booking_uid, on_date::text AS on_date, minutes, note FROM session_log
      WHERE client_id = ${clientId} ORDER BY on_date DESC NULLS LAST, created_at DESC LIMIT 500
    `) as LogRow[];
    return rows.map((r) => ({ id: r.id, bookingUid: r.booking_uid, onDate: r.on_date, minutes: r.minutes, note: r.note }));
  }

  /** Every client's log for one month's view: corrections for these bookings, and hand-logged days in `month` (YYYY-MM). */
  async forBookingsAndMonth(bookingUids: readonly string[], month: string): Promise<(SessionLogEntry & { clientId: string })[]> {
    if (!/^\d{4}-\d{2}$/.test(month)) return [];
    const rows = (await this.sql`
      SELECT id, client_id, booking_uid, on_date::text AS on_date, minutes, note FROM session_log
      WHERE booking_uid = ANY (${[...bookingUids]}::text[]) OR to_char(on_date, 'YYYY-MM') = ${month}
    `) as (LogRow & { client_id: string })[];
    return rows.map((r) => ({ id: r.id, clientId: r.client_id, bookingUid: r.booking_uid, onDate: r.on_date, minutes: r.minutes, note: r.note }));
  }

  /** A booking's real length replaces any earlier one; a hand-logged session is added. */
  async save(clientId: string, input: SessionLogInput): Promise<void> {
    if (!UUID.test(clientId)) return;
    if (input.bookingUid) {
      await this.sql`
        INSERT INTO session_log (client_id, booking_uid, minutes, note) VALUES (${clientId}, ${input.bookingUid}, ${input.minutes}, ${input.note})
        ON CONFLICT (client_id, booking_uid) WHERE booking_uid IS NOT NULL
        DO UPDATE SET minutes = EXCLUDED.minutes, note = CASE WHEN EXCLUDED.note = '' THEN session_log.note ELSE EXCLUDED.note END, updated_at = now()
      `;
    } else {
      await this.sql`
        INSERT INTO session_log (client_id, on_date, minutes, note) VALUES (${clientId}, ${input.onDate}, ${input.minutes}, ${input.note})
      `;
    }
  }

  /** The owner's corrections for these Cal.com bookings, by booking uid (minutes studied). */
  async byBookingUids(uids: readonly string[]): Promise<Map<string, number>> {
    if (uids.length === 0) return new Map();
    const rows = (await this.sql`SELECT booking_uid, minutes FROM session_log WHERE booking_uid = ANY (${[...uids]}::text[])`) as { booking_uid: string; minutes: number }[];
    return new Map(rows.map((r) => [r.booking_uid, r.minutes]));
  }

  /** A booking back to its booked length. */
  async removeBooking(clientId: string, uid: string): Promise<void> {
    if (!UUID.test(clientId)) return;
    await this.sql`DELETE FROM session_log WHERE client_id = ${clientId} AND booking_uid = ${uid}`;
  }

  /** Back to the booked length (a correction), or gone (a hand-logged session). */
  async remove(clientId: string, id: string): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(id)) return;
    await this.sql`DELETE FROM session_log WHERE id = ${id} AND client_id = ${clientId}`;
  }
}
