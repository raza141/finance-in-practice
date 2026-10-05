import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { Client, ClientInput } from "../types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saved clients (migration 013). Invoices keep their own snapshot of the contact details. */
export class ClientRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): ClientRepository | null {
    const sql = Database.sql();
    return sql ? new ClientRepository(sql) : null;
  }

  async all(): Promise<Client[]> {
    return (await this.sql`
      SELECT id, name, email, phone, address FROM clients ORDER BY lower(name) LIMIT 1000
    `) as Client[];
  }

  async byId(id: string): Promise<Client | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`SELECT id, name, email, phone, address FROM clients WHERE id = ${id}`) as Client[];
    return row ?? null;
  }

  /** The oldest client saved with this email, if any. */
  async byEmail(email: string): Promise<Client | null> {
    const [row] = (await this.sql`
      SELECT id, name, email, phone, address FROM clients WHERE email = ${email.toLowerCase()} ORDER BY created_at LIMIT 1
    `) as Client[];
    return row ?? null;
  }

  async create(input: ClientInput): Promise<string> {
    const [row] = (await this.sql`
      INSERT INTO clients (name, email, phone, address)
      VALUES (${input.name}, ${input.email}, ${input.phone}, ${input.address})
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
      UPDATE clients SET name = ${input.name}, email = ${input.email}, phone = ${input.phone},
                         address = ${input.address}, updated_at = now()
      WHERE id = ${id} RETURNING id
    `;
    return rows.length > 0;
  }

  /** Their invoices keep their snapshot and just lose the link (ON DELETE SET NULL). */
  async remove(id: string): Promise<void> {
    if (UUID.test(id)) await this.sql`DELETE FROM clients WHERE id = ${id}`;
  }
}
