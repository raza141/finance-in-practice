import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { RegistrationInput, StudentRegistration } from "../types";

interface RegistrationRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  course: string;
  created_at: Date | string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public sign-ups (037_student_registrations). The website only inserts; approving is the owner's call in admin. */
export class RegistrationRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): RegistrationRepository | null {
    const sql = Database.sql();
    return sql ? new RegistrationRepository(sql) : null;
  }

  async create(input: RegistrationInput): Promise<void> {
    await this.sql`
      INSERT INTO student_registrations (name, email, phone, course)
      VALUES (${input.name}, ${input.email}, ${input.phone}, ${input.course})
    `;
  }

  async pending(): Promise<StudentRegistration[]> {
    const rows = (await this.sql`
      SELECT id, name, email, phone, course, created_at FROM student_registrations ORDER BY created_at DESC LIMIT 100
    `) as RegistrationRow[];
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email, phone: r.phone, course: r.course, createdAt: new Date(r.created_at).toISOString() }));
  }

  /**
   * Owner approval: adds `course` to the client with this email (filling a
   * missing phone), or creates the client. Returns the client and who to tell.
   */
  async approve(id: string, course: string): Promise<{ clientId: string; name: string; email: string } | null> {
    if (!UUID.test(id)) return null;
    const [registration] = (await this.sql`SELECT name, email, phone FROM student_registrations WHERE id = ${id}`) as RegistrationRow[];
    if (!registration) return null;
    const [existing] = (await this.sql`
      SELECT id FROM clients WHERE lower(email) = ${registration.email} ORDER BY created_at LIMIT 1
    `) as { id: string }[];
    let clientId = existing?.id;
    if (clientId) {
      await this.sql`
        UPDATE clients SET
          courses = CASE WHEN ${course} = ANY(courses) THEN courses ELSE array_append(courses, ${course}) END,
          phone = CASE WHEN phone = '' THEN ${registration.phone} ELSE phone END,
          updated_at = now()
        WHERE id = ${clientId}
      `;
    } else {
      const [row] = (await this.sql`
        INSERT INTO clients (name, email, phone, address, courses)
        VALUES (${registration.name}, ${registration.email}, ${registration.phone}, '', ARRAY[${course}]::text[])
        RETURNING id
      `) as { id: string }[];
      clientId = row.id;
    }
    await this.sql`DELETE FROM student_registrations WHERE id = ${id}`;
    return { clientId, name: registration.name, email: registration.email };
  }

  async remove(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`DELETE FROM student_registrations WHERE id = ${id}`;
  }
}
