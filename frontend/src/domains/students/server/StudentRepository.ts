import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { Student } from "../types";

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

  /** What a student may book: their own courses first, then every published course (title order). */
  async bookableCourses(student: Student): Promise<string[]> {
    const rows = (await this.sql`SELECT title FROM courses WHERE is_active ORDER BY title`) as { title: string }[];
    return [...new Set([...student.courses, ...rows.map((r) => r.title)])];
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
