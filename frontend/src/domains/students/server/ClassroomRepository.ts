import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { ClassroomAccess, StudentClassroom } from "../types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-course Google Classroom invites (038_course_classroom). Kept out of the
 * Course type on purpose: course pages are public, the invite is not. Each
 * student's access is approved by the owner (classroom_access, 039).
 */
export class ClassroomRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): ClassroomRepository | null {
    const sql = Database.sql();
    return sql ? new ClassroomRepository(sql) : null;
  }

  async linkFor(courseId: string): Promise<string | null> {
    if (!UUID.test(courseId)) return null;
    const [row] = (await this.sql`SELECT classroom_url FROM courses WHERE id = ${courseId}`) as { classroom_url: string | null }[];
    return row?.classroom_url ?? null;
  }

  async save(courseId: string, url: string | null): Promise<void> {
    if (!UUID.test(courseId)) return;
    await this.sql`UPDATE courses SET classroom_url = ${url}, updated_at = now() WHERE id = ${courseId}`;
  }

  /**
   * The student's courses that have a Classroom, with their access. The invite
   * is only returned once the owner approved it (a published course wins over a
   * draft with the same title).
   */
  async forClient(clientId: string, titles: readonly string[]): Promise<StudentClassroom[]> {
    if (titles.length === 0 || !UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT DISTINCT ON (c.title) c.title, c.classroom_url, a.status
      FROM courses c
      LEFT JOIN classroom_access a ON a.client_id = ${clientId} AND a.course = c.title
      WHERE c.title = ANY(${[...titles]}::text[]) AND c.classroom_url IS NOT NULL
      ORDER BY c.title, c.is_active DESC
    `) as { title: string; classroom_url: string; status: Exclude<ClassroomAccess, "none"> | null }[];
    return titles.flatMap((title) => {
      const row = rows.find((r) => r.title === title);
      if (!row) return [];
      const access = row.status ?? "none";
      return [{ title, access, url: access === "approved" ? row.classroom_url : null }];
    });
  }

  /** A student asks for access. True only for a new request (no re-asking after a removal). */
  async request(clientId: string, course: string): Promise<boolean> {
    const rows = await this.sql`
      INSERT INTO classroom_access (client_id, course, status) VALUES (${clientId}, ${course}, 'requested')
      ON CONFLICT (client_id, course) DO NOTHING
      RETURNING course
    `;
    return rows.length > 0;
  }

  /** The owner approves or removes access (also works before any request). */
  async decide(clientId: string, course: string, status: "approved" | "removed"): Promise<void> {
    if (!UUID.test(clientId)) return;
    await this.sql`
      INSERT INTO classroom_access (client_id, course, status, decided_at) VALUES (${clientId}, ${course}, ${status}, now())
      ON CONFLICT (client_id, course) DO UPDATE SET status = EXCLUDED.status, decided_at = now()
    `;
  }
}
