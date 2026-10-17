import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { Ticker } from "@/domains/testimonials/types";

import { Batches } from "../services/Batches";
import type { Batch, ClassroomAccess, PrivateClassroom, StudentClassroom } from "../types";

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
   * The student's courses that have a Classroom, with their access. An exam
   * course is always listed: its class comes from the student's batch, which may
   * not be set or opened yet. The invite is only returned once the owner approved
   * it (a published course wins over a draft with the same title).
   */
  async forClient(clientId: string, titles: readonly string[]): Promise<StudentClassroom[]> {
    if (titles.length === 0 || !UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT DISTINCT ON (c.title) c.title, c.testimonial_ticker AS ticker, c.classroom_url, a.status, cb.label AS batch, b.classroom_url AS batch_url
      FROM courses c
      LEFT JOIN classroom_access a ON a.client_id = ${clientId} AND a.course = c.title
      LEFT JOIN client_batches cb ON cb.client_id = ${clientId} AND cb.course = c.title
      LEFT JOIN batches b ON b.course = c.title AND b.label = cb.label
      WHERE c.title = ANY(${[...titles]}::text[])
      ORDER BY c.title, c.is_active DESC
    `) as {
      title: string;
      ticker: Ticker | null;
      classroom_url: string | null;
      status: Exclude<ClassroomAccess, "none"> | null;
      batch: string | null;
      batch_url: string | null;
    }[];
    return titles.flatMap((title) => {
      const row = rows.find((r) => r.title === title);
      if (!row) return [];
      const batched = Batches.windows(row.ticker) !== null;
      const link = batched ? row.batch_url : row.classroom_url;
      if (!batched && !link) return [];
      const access = row.status ?? "none";
      return [{ title, batched, batch: batched ? row.batch : null, hasClass: link !== null, access, url: access === "approved" ? link : null }];
    });
  }

  /** Published courses for the public form, and the sittings each exam course offers. */
  async registrationOptions(now = new Date()): Promise<{ titles: string[]; batches: Record<string, string[]> }> {
    const [courses, opened] = await Promise.all([
      // Same list and order as CourseRepository.active().
      this.sql`SELECT title, testimonial_ticker AS ticker FROM courses WHERE is_active ORDER BY start_date NULLS LAST, title`.then(
        (r) => r as { title: string; ticker: Ticker | null }[],
      ),
      this.batches(),
    ]);
    const batches: Record<string, string[]> = {};
    for (const c of courses) {
      const windows = Batches.windows(c.ticker);
      if (windows) batches[c.title] = Batches.offer(windows, opened.filter((b) => b.course === c.title), now);
    }
    return { titles: courses.map((c) => c.title), batches };
  }

  /** Exam courses (published or draft) and what the owner may assign or open for each. */
  async batchCourses(now = new Date()): Promise<{ title: string; assignable: string[]; windows: { label: string; starts: string }[] }[]> {
    const [courses, opened] = await Promise.all([
      this.sql`SELECT DISTINCT ON (title) title, testimonial_ticker AS ticker FROM courses WHERE testimonial_ticker IS NOT NULL ORDER BY title, is_active DESC`.then(
        (r) => r as { title: string; ticker: Ticker | null }[],
      ),
      this.batches(),
    ]);
    return courses.flatMap((c) => {
      const windows = Batches.windows(c.ticker);
      return windows ? [{ title: c.title, assignable: Batches.assignable(windows, opened.filter((b) => b.course === c.title), now), windows }] : [];
    });
  }

  /** Every opened batch, soonest exam first within a course, with how many students picked it. */
  async batches(): Promise<Batch[]> {
    return (await this.sql`
      SELECT b.id, b.course, b.label, to_char(b.exam_date, 'YYYY-MM-DD') AS "examDate", b.classroom_url AS "classroomUrl",
        (SELECT count(*) FROM client_batches cb WHERE cb.course = b.course AND cb.label = b.label)::int AS students
      FROM batches b ORDER BY b.course, b.exam_date
    `) as Batch[];
  }

  /** Opens a batch; false when that course already has one for that sitting. */
  async openBatch(course: string, label: string, examDate: string, url: string | null): Promise<boolean> {
    const rows = await this.sql`
      INSERT INTO batches (course, label, exam_date, classroom_url) VALUES (${course}, ${label}, ${examDate}, ${url})
      ON CONFLICT (course, label) DO NOTHING RETURNING id
    `;
    return rows.length > 0;
  }

  async saveBatchLink(id: string, url: string | null): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`UPDATE batches SET classroom_url = ${url} WHERE id = ${id}`;
  }

  /** Only an empty batch: students who picked it would lose their place. */
  async deleteBatch(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      DELETE FROM batches b WHERE b.id = ${id}
        AND NOT EXISTS (SELECT 1 FROM client_batches cb WHERE cb.course = b.course AND cb.label = b.label)
      RETURNING b.id
    `;
    return rows.length > 0;
  }

  /** Puts a client in a batch. Moving to another batch resets their access, so the new class is asked for and approved afresh. */
  async setBatch(clientId: string, course: string, label: string): Promise<{ moved: boolean }> {
    if (!UUID.test(clientId)) return { moved: false };
    const [prev] = (await this.sql`SELECT label FROM client_batches WHERE client_id = ${clientId} AND course = ${course}`) as { label: string }[];
    if (prev?.label === label) return { moved: false };
    const moved = prev !== undefined && prev.label !== Batches.NOT_SURE;
    await this.sql.transaction([
      this.sql`
        INSERT INTO client_batches (client_id, course, label) VALUES (${clientId}, ${course}, ${label})
        ON CONFLICT (client_id, course) DO UPDATE SET label = EXCLUDED.label
      `,
      // Only a real move: placing a student for the first time keeps an approval given beforehand.
      ...(moved ? [this.sql`DELETE FROM classroom_access WHERE client_id = ${clientId} AND course = ${course}`] : []),
    ]);
    return { moved };
  }

  /** Students on an exam course with no batch yet (or "Not sure yet"), for the owner to place. */
  async unplaced(): Promise<{ id: string; name: string; course: string }[]> {
    const rows = (await this.sql`
      SELECT DISTINCT ON (cl.id, co.title) cl.id, cl.name, co.title AS course, co.testimonial_ticker AS ticker
      FROM clients cl
      JOIN courses co ON co.title = ANY(cl.courses) AND co.testimonial_ticker IS NOT NULL
      LEFT JOIN client_batches cb ON cb.client_id = cl.id AND cb.course = co.title
      WHERE cb.label IS NULL OR cb.label = ${Batches.NOT_SURE}
      ORDER BY cl.id, co.title
    `) as { id: string; name: string; course: string; ticker: Ticker | null }[];
    return rows.filter((r) => Batches.windows(r.ticker) !== null).map(({ id, name, course }) => ({ id, name, course }));
  }

  /** For the owner's "new student" email: is their batch's class ready? */
  async batchState(course: string, label: string): Promise<"ready" | "no-class" | "not-sure"> {
    if (label === Batches.NOT_SURE) return "not-sure";
    const [row] = (await this.sql`SELECT classroom_url FROM batches WHERE course = ${course} AND label = ${label}`) as { classroom_url: string | null }[];
    return row?.classroom_url ? "ready" : "no-class";
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

  /** The student's own classes, oldest first. */
  async privateFor(clientId: string): Promise<PrivateClassroom[]> {
    if (!UUID.test(clientId)) return [];
    return (await this.sql`
      SELECT id, title, note, url FROM private_classrooms WHERE client_id = ${clientId} ORDER BY created_at
    `) as PrivateClassroom[];
  }

  async addPrivate(clientId: string, input: Omit<PrivateClassroom, "id">): Promise<void> {
    if (!UUID.test(clientId)) return;
    await this.sql`
      INSERT INTO private_classrooms (client_id, title, note, url) VALUES (${clientId}, ${input.title}, ${input.note}, ${input.url})
    `;
  }

  /** The Google account the client uses in Classroom when it differs from their portal email (041). */
  async classroomEmail(clientId: string): Promise<string | null> {
    if (!UUID.test(clientId)) return null;
    const [row] = (await this.sql`SELECT classroom_email FROM clients WHERE id = ${clientId}`) as { classroom_email: string | null }[];
    return row?.classroom_email ?? null;
  }

  /** Every class link on the website, for matching to Google classes in admin. */
  async allLinks(): Promise<{ title: string; url: string }[]> {
    return (await this.sql`
      SELECT DISTINCT ON (classroom_url) title, classroom_url AS url FROM courses WHERE classroom_url IS NOT NULL
      UNION ALL
      SELECT course || ' · ' || label, classroom_url FROM batches WHERE classroom_url IS NOT NULL
      UNION ALL
      SELECT p.title || ' · ' || c.name, p.url FROM private_classrooms p JOIN clients c ON c.id = p.client_id
    `) as { title: string; url: string }[];
  }

  /** Every class link this client has or can be approved for: their course classes (their batch's, for exam courses) and private ones. */
  async linksFor(clientId: string): Promise<{ title: string; url: string; kind: "course" | "private" }[]> {
    if (!UUID.test(clientId)) return [];
    return (await this.sql`
      (SELECT DISTINCT ON (co.title) co.title, co.classroom_url AS url, 'course' AS kind
       FROM clients cl JOIN courses co ON co.title = ANY(cl.courses)
       WHERE cl.id = ${clientId} AND co.classroom_url IS NOT NULL
       ORDER BY co.title, co.is_active DESC)
      UNION ALL
      SELECT b.course, b.classroom_url, 'course' FROM client_batches cb JOIN batches b ON b.course = cb.course AND b.label = cb.label
      WHERE cb.client_id = ${clientId} AND b.classroom_url IS NOT NULL
      UNION ALL
      SELECT title, url, 'private' FROM private_classrooms WHERE client_id = ${clientId}
    `) as { title: string; url: string; kind: "course" | "private" }[];
  }

  /** Scoped to the client, so a stray id can't remove another student's class. */
  async removePrivate(clientId: string, id: string): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(id)) return;
    await this.sql`DELETE FROM private_classrooms WHERE id = ${id} AND client_id = ${clientId}`;
  }
}
