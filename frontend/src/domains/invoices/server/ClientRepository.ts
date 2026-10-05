import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { Client, ClientInput, Currency, ItemUnit } from "../types";

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
