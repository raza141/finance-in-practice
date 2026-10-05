import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { Client, ClientDashboard, ClientInput, Currency, ItemUnit } from "../types";

interface ClientRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  courses: string[];
  plan_unit: ItemUnit | null;
  plan_fee_minor: number | null;
  plan_currency: Currency;
  plan_notes: string;
}

/** Contact details only: what the invoice form and website bookings know about a new client. */
type NewClient = Pick<ClientInput, "name" | "email" | "phone" | "address">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id, name, email, phone, address, courses, plan_unit, plan_fee_minor, plan_currency, plan_notes";

/**
 * Saved clients, with their courses and payment plan (migrations 013, 014).
 * Invoices keep their own snapshot of the contact details.
 */
export class ClientRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): ClientRepository | null {
    const sql = Database.sql();
    return sql ? new ClientRepository(sql) : null;
  }

  async all(): Promise<Client[]> {
    const rows = (await this.sql`SELECT ${this.sql.unsafe(COLUMNS)} FROM clients ORDER BY lower(name) LIMIT 1000`) as ClientRow[];
    return rows.map(ClientRepository.toClient);
  }

  async byId(id: string): Promise<Client | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`SELECT ${this.sql.unsafe(COLUMNS)} FROM clients WHERE id = ${id}`) as ClientRow[];
    return row ? ClientRepository.toClient(row) : null;
  }

  /** The most recently added clients. */
  async recent(limit = 5): Promise<Client[]> {
    const rows = (await this.sql`SELECT ${this.sql.unsafe(COLUMNS)} FROM clients ORDER BY created_at DESC LIMIT ${limit}`) as ClientRow[];
    return rows.map(ClientRepository.toClient);
  }

  /** Client counts and expected monthly income for the admin dashboard ("this month" in Dubai). */
  async dashboard(): Promise<ClientDashboard> {
    const [[counts], expected] = await Promise.all([
      this.sql`
        SELECT count(*) AS total,
          count(*) FILTER (WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai') AS new_this_month,
          count(*) FILTER (WHERE plan_unit = 'hour') AS hour,
          count(*) FILTER (WHERE plan_unit = 'month') AS month,
          count(*) FILTER (WHERE plan_unit = 'on-demand') AS on_demand,
          count(*) FILTER (WHERE plan_unit = 'contract') AS contract
        FROM clients
      `,
      this.sql`
        SELECT plan_currency AS currency, sum(plan_fee_minor * greatest(cardinality(courses), 1))::bigint AS total
        FROM clients
        WHERE plan_unit = 'month' AND plan_fee_minor IS NOT NULL
        GROUP BY plan_currency
        ORDER BY plan_currency
      `,
    ]);
    const c = counts as Record<string, string>;
    return {
      total: Number(c.total),
      newThisMonth: Number(c.new_this_month),
      byPlan: { hour: Number(c.hour), month: Number(c.month), "on-demand": Number(c.on_demand), contract: Number(c.contract) },
      expectedMonthly: (expected as Record<string, string>[]).map((row) => ({ currency: row.currency as Currency, totalMinor: Number(row.total) })),
    };
  }

  /** The oldest client saved with this email, if any. */
  async byEmail(email: string): Promise<Client | null> {
    const [row] = (await this.sql`
      SELECT ${this.sql.unsafe(COLUMNS)} FROM clients WHERE email = ${email.toLowerCase()} ORDER BY created_at LIMIT 1
    `) as ClientRow[];
    return row ? ClientRepository.toClient(row) : null;
  }

  /** Courses and plan default to none when only contact details are given. */
  async create(input: NewClient & Partial<ClientInput>): Promise<string> {
    const [row] = (await this.sql`
      INSERT INTO clients (name, email, phone, address, courses, plan_unit, plan_fee_minor, plan_currency, plan_notes)
      VALUES (${input.name}, ${input.email}, ${input.phone}, ${input.address}, ${input.courses ?? []}::text[],
              ${input.planUnit ?? null}, ${input.planFeeMinor ?? null}, ${input.planCurrency ?? "AED"}, ${input.planNotes ?? ""})
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /**
   * A website booking: saves a new client, or for an email already on file
   * fills in a phone it lacked (never overwrites what the owner entered).
   */
  async recordBooking(booking: { name: string; email: string; phone: string }): Promise<void> {
    const email = booking.email.toLowerCase();
    const phone = booking.phone.slice(0, 40);
    const existing = await this.byEmail(email);
    if (existing) {
      if (!existing.phone && phone) await this.sql`UPDATE clients SET phone = ${phone}, updated_at = now() WHERE id = ${existing.id}`;
      return;
    }
    await this.create({ name: booking.name.slice(0, 120), email, phone, address: "" });
  }

  async update(id: string, input: ClientInput): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE clients SET name = ${input.name}, email = ${input.email}, phone = ${input.phone}, address = ${input.address},
        courses = ${input.courses}::text[], plan_unit = ${input.planUnit}, plan_fee_minor = ${input.planFeeMinor},
        plan_currency = ${input.planCurrency}, plan_notes = ${input.planNotes}, updated_at = now()
      WHERE id = ${id} RETURNING id
    `;
    return rows.length > 0;
  }

  /** Their invoices keep their snapshot and just lose the link (ON DELETE SET NULL). */
  async remove(id: string): Promise<void> {
    if (UUID.test(id)) await this.sql`DELETE FROM clients WHERE id = ${id}`;
  }

  private static toClient(row: ClientRow): Client {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      address: row.address,
      courses: row.courses,
      planUnit: row.plan_unit,
      planFeeMinor: row.plan_fee_minor,
      planCurrency: row.plan_currency,
      planNotes: row.plan_notes,
    };
  }
}
