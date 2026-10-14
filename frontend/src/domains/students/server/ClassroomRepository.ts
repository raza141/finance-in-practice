import "server-only";

import { Database, type Sql } from "@/core/db/Database";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-course Google Classroom invites (038_course_classroom). Kept out of the
 * Course type on purpose: course pages are public, the invite is not.
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

  /** Course title -> invite, for the student's programmes (a published course wins over a draft with the same title). */
  async forTitles(titles: readonly string[]): Promise<{ title: string; url: string }[]> {
    if (titles.length === 0) return [];
    const rows = (await this.sql`
      SELECT DISTINCT ON (title) title, classroom_url FROM courses
      WHERE title = ANY(${[...titles]}::text[]) AND classroom_url IS NOT NULL
      ORDER BY title, is_active DESC
    `) as { title: string; classroom_url: string }[];
    return titles.flatMap((title) => {
      const row = rows.find((r) => r.title === title);
      return row ? [{ title, url: row.classroom_url }] : [];
    });
  }
}
