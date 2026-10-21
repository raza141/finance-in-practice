import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import { Batches } from "../services/Batches";
import type { BillingBasis, CoursePrices, RegistrationInput, Student } from "../types";

interface StudentRow {
  id: string;
  name: string;
  email: string;
  courses: string[];
}

/**
 * Enrolled students = clients with at least one course (migration 014), and
 * their sign-in sessions (035_student_sessions). Website diagnostic bookings
 * also create clients, but with no courses, so they can't sign in.
 */
export class StudentRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): StudentRepository | null {
    const sql = Database.sql();
    return sql ? new StudentRepository(sql) : null;
  }

  /** Any client row with this email and a course: a diagnostic-only duplicate row must not hide the enrolled one. */
  async enrolledByEmail(email: string): Promise<Student | null> {
    const [row] = (await this.sql`
      SELECT id, name, email, courses FROM clients
      WHERE lower(email) = ${email.trim().toLowerCase()} AND cardinality(courses) > 0
      ORDER BY updated_at DESC
      LIMIT 1
    `) as StudentRow[];
    return row ?? null;
  }

  /** The hourly / monthly switch they asked for (null: none open), and the prices of their first course that has a page. */
  async basis(clientId: string): Promise<{ requested: BillingBasis | null; requestedAt: string | null; course: string | null; prices: CoursePrices | null }> {
    const [row] = (await this.sql`
      SELECT c.requested_basis, c.requested_at::text AS requested_at, co.title, co.price_minor, co.monthly_fee_minor::int AS monthly_fee_minor, co.monthly_hours, co.currency
      FROM clients c
      LEFT JOIN LATERAL (
        SELECT title, price_minor, monthly_fee_minor, monthly_hours, currency FROM courses
        WHERE title = ANY (c.courses) ORDER BY array_position(c.courses, title), is_active DESC LIMIT 1
      ) co ON true
      WHERE c.id = ${clientId}
    `) as {
      requested_basis: BillingBasis | null;
      requested_at: string | null;
      title: string | null;
      price_minor: number | null;
      monthly_fee_minor: number | null;
      monthly_hours: number | null;
      currency: string | null;
    }[];
    if (!row) return { requested: null, requestedAt: null, course: null, prices: null };
    return {
      requested: row.requested_basis,
      requestedAt: row.requested_at,
      course: row.title,
      prices: row.currency ? { hourMinor: row.price_minor, monthMinor: row.monthly_fee_minor, monthHours: row.monthly_hours, currency: row.currency } : null,
    };
  }

  /** Opens (or replaces) the student's request to pay hourly or monthly; null withdraws it. False when nothing changed. */
  async requestBasis(clientId: string, basis: BillingBasis | null): Promise<boolean> {
    const rows = await this.sql`
      UPDATE clients SET requested_basis = ${basis}, requested_at = CASE WHEN ${basis}::text IS NULL THEN NULL ELSE now() END
      WHERE id = ${clientId} AND requested_basis IS DISTINCT FROM ${basis}::text
      RETURNING id
    `;
    return rows.length > 0;
  }

  /** What a student may book: their own courses first, then every published course (title order). */
  async bookableCourses(student: Student): Promise<string[]> {
    const rows = (await this.sql`SELECT title FROM courses WHERE is_active ORDER BY title`) as { title: string }[];
    return [...new Set([...student.courses, ...rows.map((r) => r.title)])];
  }

  /**
   * Self-service join, only after Google proved the email: adds the course to
   * the client with that email (filling a missing name or phone), or creates the
   * client. Either way the client shows as new in admin (seen_at NULL). `added`:
   * false when they already had that course (a repeat click on an email link).
   * Their sitting is saved too; a repeat join only replaces "Not sure yet".
   */
  async join(input: RegistrationInput): Promise<{ id: string; added: boolean }> {
    const result = await this.enrol(input);
    // The form requires the terms box (RegistrationContract): record the live version they accepted.
    await this.sql`
      UPDATE clients SET terms_accepted_at = now(), terms_version = (SELECT id FROM site_terms ORDER BY created_at DESC LIMIT 1) WHERE id = ${result.id}
    `;
    // Hourly: their course's hourly rate becomes the plan, unless the owner already set one.
    // Monthly: an open request, answered with an agreement quote.
    if (input.basis === "hour") {
      await this.sql`
        UPDATE clients c SET plan_unit = 'hour', plan_fee_minor = co.price_minor, plan_currency = co.currency, updated_at = now()
        FROM courses co
        WHERE c.id = ${result.id} AND c.plan_unit IS NULL AND co.title = ${input.course} AND co.is_active AND co.price_minor > 0
          AND co.currency IN ('AED', 'USD', 'PKR', 'GBP', 'EUR')
      `;
    } else {
      await this.sql`UPDATE clients SET requested_basis = 'month', requested_at = now() WHERE id = ${result.id} AND requested_basis IS NULL`;
    }
    if (input.batch) {
      await this.sql`
        INSERT INTO client_batches (client_id, course, label) VALUES (${result.id}, ${input.course}, ${input.batch})
        ON CONFLICT (client_id, course) DO UPDATE SET label = EXCLUDED.label WHERE client_batches.label = ${Batches.NOT_SURE}
      `;
    }
    return result;
  }

  private async enrol(input: RegistrationInput): Promise<{ id: string; added: boolean }> {
    const email = input.email.toLowerCase();
    const [existing] = (await this.sql`
      SELECT id, ${input.course} = ANY(courses) AS has FROM clients WHERE lower(email) = ${email} ORDER BY created_at LIMIT 1
    `) as { id: string; has: boolean }[];
    if (existing) {
      await this.sql`
        UPDATE clients SET
          courses = CASE WHEN ${input.course} = ANY(courses) THEN courses ELSE array_append(courses, ${input.course}) END,
          phone = CASE WHEN phone = '' THEN ${input.phone} ELSE phone END,
          seen_at = CASE WHEN ${input.course} = ANY(courses) THEN seen_at ELSE NULL END,
          updated_at = now()
        WHERE id = ${existing.id}
      `;
      return { id: existing.id, added: !existing.has };
    }
    const [row] = (await this.sql`
      INSERT INTO clients (name, email, phone, address, courses, seen_at)
      VALUES (${input.name}, ${email}, ${input.phone}, '', ARRAY[${input.course}]::text[], NULL)
      RETURNING id
    `) as { id: string }[];
    return { id: row.id, added: true };
  }

  /** Email registration, before the address is proven: parked in 037 until the emailed link is opened. Prunes day-old rows. */
  async park(input: RegistrationInput): Promise<string> {
    const [, [row]] = (await this.sql.transaction([
      this.sql`DELETE FROM student_registrations WHERE created_at < now() - interval '1 day'`,
      this.sql`
        INSERT INTO student_registrations (name, email, phone, course, batch, basis)
        VALUES (${input.name}, ${input.email.toLowerCase()}, ${input.phone}, ${input.course}, ${input.batch}, ${input.basis})
        RETURNING id
      `,
    ])) as [unknown, { id: string }[]];
    return row.id;
  }

  /** A parked registration, while its link can still be valid. */
  async parked(id: string): Promise<RegistrationInput | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [row] = (await this.sql`
      SELECT name, email, phone, course, batch, basis FROM student_registrations
      WHERE id = ${id} AND created_at > now() - interval '1 day'
    `) as RegistrationInput[];
    return row ?? null;
  }

  /** The enrolled student with this client id (email sign-in links carry the id, not the address). */
  async enrolledById(id: string): Promise<Student | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [row] = (await this.sql`
      SELECT id, name, email, courses FROM clients WHERE id = ${id} AND cardinality(courses) > 0
    `) as StudentRow[];
    return row ?? null;
  }

  async createSession(clientId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.sql.transaction([
      this.sql`DELETE FROM student_sessions WHERE expires_at < now()`,
      this.sql`INSERT INTO student_sessions (token_hash, client_id, expires_at) VALUES (${tokenHash}, ${clientId}, ${expiresAt})`,
    ]);
  }

  /** The student owning an unexpired session, while they still have a course. */
  async studentBySession(tokenHash: string): Promise<Student | null> {
    const [row] = (await this.sql`
      SELECT c.id, c.name, c.email, c.courses
      FROM student_sessions s JOIN clients c ON c.id = s.client_id
      WHERE s.token_hash = ${tokenHash} AND s.expires_at > now() AND cardinality(c.courses) > 0
    `) as StudentRow[];
    return row ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.sql`DELETE FROM student_sessions WHERE token_hash = ${tokenHash}`;
  }
}
