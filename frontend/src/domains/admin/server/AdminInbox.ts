import "server-only";

import { unstable_cache } from "next/cache";

import { Database } from "@/core/db/Database";
import { CalComClient } from "@/domains/booking/server/CalComClient";

export interface InboxCounts {
  /** Clients to look at: self-joined (or a new course) and not opened yet, or asking for a Classroom. */
  clients: number;
  /** Website bookings waiting for the owner to confirm or decline. */
  pendingBookings: number;
  /** Students asking for more hours on their monthly allowance. */
  hourRequests: number;
}

/** What needs the owner's attention, for the badges in the admin menu. */
export class AdminInbox {
  static readonly BOOKINGS_TAG = "admin-pending-bookings";

  /**
   * Upcoming unconfirmed Cal.com bookings. Cached for 2 minutes so the admin
   * menu doesn't call Cal.com on every page; confirm/decline clears it at once.
   */
  private static readonly pendingBookings = unstable_cache(
    async (): Promise<number> => {
      const cal = CalComClient.fromEnv();
      if (!cal) return 0;
      const now = Date.now();
      return (await cal.unconfirmed()).filter((b) => b.status === "pending" && Date.parse(b.end) > now).length;
    },
    ["admin-pending-bookings"],
    { revalidate: 120, tags: [AdminInbox.BOOKINGS_TAG] },
  );

  /** Every source fails on its own: a badge is never worth breaking the admin panel. */
  static async counts(): Promise<InboxCounts> {
    const sql = Database.sql();
    const [db, bookings] = await Promise.allSettled([
      sql
        ? (sql`
            SELECT
              (SELECT count(*)::int FROM (
                SELECT id FROM clients WHERE seen_at IS NULL
                UNION SELECT client_id FROM classroom_access WHERE status = 'requested'
                UNION SELECT id FROM clients WHERE requested_package_id IS NOT NULL
              ) waiting) AS clients,
              (SELECT count(*)::int FROM hour_requests WHERE status = 'pending') AS hour_requests
          ` as unknown as Promise<{ clients: number; hour_requests: number }[]>)
        : Promise.resolve([]),
      AdminInbox.pendingBookings(),
    ]);
    if (db.status === "rejected") console.error("[admin-inbox] counts failed", db.reason);
    if (bookings.status === "rejected") console.error("[admin-inbox] pending bookings failed", bookings.reason);
    const row = db.status === "fulfilled" ? db.value[0] : undefined;
    return {
      clients: row?.clients ?? 0,
      pendingBookings: bookings.status === "fulfilled" ? bookings.value : 0,
      hourRequests: row?.hour_requests ?? 0,
    };
  }

  /** Ids of clients still marked new, for the "New" tag on the Clients list. */
  static async unseenIds(): Promise<Set<string>> {
    const sql = Database.sql();
    if (!sql) return new Set();
    const rows = (await sql`
      SELECT id FROM clients WHERE seen_at IS NULL
      UNION SELECT client_id FROM classroom_access WHERE status = 'requested'
      UNION SELECT id FROM clients WHERE requested_package_id IS NOT NULL
    `) as { id: string }[];
    return new Set(rows.map((r) => r.id));
  }

  /** Opening a client clears its "new" mark. */
  static async markSeen(clientId: string): Promise<void> {
    const sql = Database.sql();
    if (sql) await sql`UPDATE clients SET seen_at = now() WHERE id = ${clientId} AND seen_at IS NULL`;
  }
}
