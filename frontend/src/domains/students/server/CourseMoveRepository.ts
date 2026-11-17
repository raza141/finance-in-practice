import "server-only";

import { Database, type Sql } from "@/core/db/Database";
import type { Ticker } from "@/domains/testimonials/types";

import { Batches, type OpenedBatch } from "../services/Batches";
import type { CourseRequestRef, ExamResult, NextStepInput } from "../services/NextSteps";
import type { Student } from "../types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CourseRequest extends CourseRequestRef {
  id: string;
  createdAt: string;
}

/** Exam results per sitting and course requests (076_course_moves): next level, retake or another course, same account. */
export class CourseMoveRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): CourseMoveRepository | null {
    const sql = Database.sql();
    return sql ? new CourseMoveRepository(sql) : null;
  }

  /** Everything NextSteps needs for this student. */
  async input(student: Student, now = new Date()): Promise<NextStepInput> {
    const [courses, enrolled, results, pending, opened] = await Promise.all([
      this.sql`SELECT DISTINCT title, testimonial_ticker AS ticker FROM courses WHERE is_active ORDER BY title` as unknown as Promise<{ title: string; ticker: Ticker | null }[]>,
      this.sql`SELECT courses FROM clients WHERE id = ${student.id}` as unknown as Promise<{ courses: string[] }[]>,
      this.results(student.id),
      this.pending(student.id),
      this.sql`SELECT course, label, to_char(exam_date, 'YYYY-MM-DD') AS "examDate" FROM batches` as unknown as Promise<(OpenedBatch & { course: string })[]>,
    ]);
    const byCourse: Record<string, OpenedBatch[]> = {};
    for (const b of opened) (byCourse[b.course] ??= []).push({ label: b.label, examDate: b.examDate });
    return { ended: student.ended, live: student.courses, enrolled: enrolled[0]?.courses ?? [], courses, results, pending, opened: byCourse, now };
  }

  async results(clientId: string): Promise<(ExamResult & { reportedOn: string })[]> {
    return (await this.sql`
      SELECT course, label, passed, to_char(reported_on, 'YYYY-MM-DD') AS "reportedOn" FROM exam_results WHERE client_id = ${clientId} ORDER BY reported_on DESC
    `) as (ExamResult & { reportedOn: string })[];
  }

  async pending(clientId: string): Promise<CourseRequest[]> {
    return (await this.sql`
      SELECT id, course, label, retake, to_char(created_at, 'YYYY-MM-DD') AS "createdAt"
      FROM course_requests WHERE client_id = ${clientId} AND status = 'pending' ORDER BY created_at
    `) as CourseRequest[];
  }

  /** The student's own report; a second click on the same sitting corrects it. */
  async report(clientId: string, course: string, label: string, passed: boolean): Promise<void> {
    await this.sql`
      INSERT INTO exam_results (client_id, course, label, passed) VALUES (${clientId}, ${course}, ${label}, ${passed})
      ON CONFLICT (client_id, course, label) DO UPDATE SET passed = EXCLUDED.passed, reported_on = current_date
    `;
  }

  /** Undo a report, only while nothing was asked on the strength of it. */
  async unreport(clientId: string, course: string, label: string): Promise<void> {
    await this.sql`
      DELETE FROM exam_results WHERE client_id = ${clientId} AND course = ${course} AND label = ${label}
        AND NOT EXISTS (SELECT 1 FROM course_requests WHERE client_id = ${clientId} AND status = 'pending')
    `;
  }

  /** True only for a new request (one pending per course). */
  async request(clientId: string, ask: CourseRequestRef): Promise<boolean> {
    const rows = await this.sql`
      INSERT INTO course_requests (client_id, course, label, retake) VALUES (${clientId}, ${ask.course}, ${ask.label}, ${ask.retake})
      ON CONFLICT (client_id, course) WHERE status = 'pending' DO NOTHING
      RETURNING id
    `;
    return rows.length > 0;
  }

  /**
   * Opens the asked course: on the client, in the asked sitting (a retake moves the batch, so its class is asked
   * for afresh), unpaused. A retake pauses the level above it. Returns the request, or null when it wasn't pending.
   */
  async approve(id: string, pause: string | null): Promise<(CourseRequest & { clientId: string }) | null> {
    if (!UUID.test(id)) return null;
    const [req] = (await this.sql`
      SELECT id, client_id AS "clientId", course, label, retake, to_char(created_at, 'YYYY-MM-DD') AS "createdAt"
      FROM course_requests WHERE id = ${id} AND status = 'pending'
    `) as (CourseRequest & { clientId: string })[];
    if (!req) return null;
    // All or nothing: a failed step leaves the request pending, to approve again.
    await this.sql.transaction([
      this.sql`UPDATE course_requests SET status = 'approved', decided_at = now() WHERE id = ${id} AND status = 'pending'`,
      this.sql`
        UPDATE clients SET courses = CASE WHEN ${req.course} = ANY(courses) THEN courses ELSE array_append(courses, ${req.course}) END, updated_at = now()
        WHERE id = ${req.clientId}
      `,
      ...(req.label
        ? [
            // A new sitting is a new class: its access is asked for and approved afresh (as ClassroomRepository.setBatch).
            this.sql`
              DELETE FROM classroom_access WHERE client_id = ${req.clientId} AND course = ${req.course}
                AND EXISTS (SELECT 1 FROM client_batches WHERE client_id = ${req.clientId} AND course = ${req.course} AND label NOT IN (${req.label}, ${Batches.NOT_SURE}))
            `,
            this.sql`
              INSERT INTO client_batches (client_id, course, label) VALUES (${req.clientId}, ${req.course}, ${req.label})
              ON CONFLICT (client_id, course) DO UPDATE SET label = EXCLUDED.label, exam_date = NULL, paused_at = NULL
            `,
          ]
        : [this.sql`UPDATE client_batches SET paused_at = NULL WHERE client_id = ${req.clientId} AND course = ${req.course}`]),
      ...(pause
        ? [
            this.sql`
              INSERT INTO client_batches (client_id, course, label, paused_at)
              SELECT ${req.clientId}, ${pause}, ${Batches.NOT_SURE}, now() FROM clients WHERE id = ${req.clientId} AND ${pause} = ANY(courses)
              ON CONFLICT (client_id, course) DO UPDATE SET paused_at = now()
            `,
          ]
        : []),
    ]);
    return req;
  }

  async decline(id: string): Promise<string | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      UPDATE course_requests SET status = 'declined', decided_at = now() WHERE id = ${id} AND status = 'pending' RETURNING client_id AS "clientId"
    `) as { clientId: string }[];
    return row?.clientId ?? null;
  }

  /** The course a pass of this one leads to, by ticker (NextSteps.NEXT). */
  async titleFor(ticker: Ticker): Promise<string | null> {
    const [row] = (await this.sql`SELECT title FROM courses WHERE testimonial_ticker = ${ticker} ORDER BY is_active DESC LIMIT 1`) as { title: string }[];
    return row?.title ?? null;
  }

  async tickerOf(title: string): Promise<Ticker | null> {
    const [row] = (await this.sql`SELECT testimonial_ticker AS ticker FROM courses WHERE title = ${title} ORDER BY is_active DESC LIMIT 1`) as { ticker: Ticker | null }[];
    return row?.ticker ?? null;
  }
}
