import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { StudyPlanInput, StudyPlanItem, StudyStatus } from "../types";

interface ItemRow {
  id: string;
  due_on: string | null;
  start_on: string | null;
  mock_id: string | null;
  topic: string;
  status: StudyStatus;
  note: string;
  material_url: string | null;
  student_changed_at: string | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Each student's study plan. Schema: 036_study_plan. Every write is scoped to the client, so ids from a form can't touch another student's plan. */
export class StudyPlanRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): StudyPlanRepository | null {
    const sql = Database.sql();
    return sql ? new StudyPlanRepository(sql) : null;
  }

  /** Dated topics first, in date order; unscheduled ones after, in the order they were added. */
  async forClient(clientId: string): Promise<StudyPlanItem[]> {
    if (!UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT id, due_on::text AS due_on, start_on::text AS start_on, mock_id, topic, status, note, material_url, student_changed_at::text AS student_changed_at FROM study_plan_items
      WHERE client_id = ${clientId}
      ORDER BY due_on NULLS LAST, created_at
    `) as ItemRow[];
    return rows.map((r) => ({ id: r.id, dueOn: r.due_on, startOn: r.start_on, mockId: r.mock_id, topic: r.topic, status: r.status, note: r.note, materialUrl: r.material_url, studentChangedAt: r.student_changed_at }));
  }

  /**
   * The nearest upcoming exam among the student's batches with portal access left: their own day if they picked
   * one (071), else the batch's. `batchDate` and `picked` let them choose their day inside the batch's window.
   */
  async nextExam(clientId: string): Promise<{ course: string; date: string; batchDate: string; picked: boolean; hideCountdown: boolean } | null> {
    if (!UUID.test(clientId)) return null;
    const [row] = (await this.sql`
      SELECT b.course, to_char(COALESCE(cb.exam_date, b.exam_date), 'YYYY-MM-DD') AS date,
        to_char(b.exam_date, 'YYYY-MM-DD') AS "batchDate", cb.exam_date IS NOT NULL AS picked,
        c.hide_exam_countdown AS "hideCountdown"
      FROM client_batches cb JOIN batches b ON b.course = cb.course AND b.label = cb.label JOIN clients c ON c.id = cb.client_id
      WHERE cb.client_id = ${clientId} AND COALESCE(cb.exam_date, b.exam_date) >= current_date AND batch_access_ends(cb, b) >= current_date
      ORDER BY COALESCE(cb.exam_date, b.exam_date)
      LIMIT 1
    `) as { course: string; date: string; batchDate: string; picked: boolean; hideCountdown: boolean }[];
    return row ?? null;
  }

  /** The student's own exam day for one of their batches (071); the action checks it's inside the batch's window. */
  async setExamDate(clientId: string, course: string, date: string): Promise<boolean> {
    if (!UUID.test(clientId)) return false;
    const rows = await this.sql`UPDATE client_batches SET exam_date = ${date}::date WHERE client_id = ${clientId} AND course = ${course} RETURNING 1`;
    return rows.length > 0;
  }

  /** The student hides or shows their days-to-exam countdown (073), on every device. */
  async setCountdownHidden(clientId: string, hidden: boolean): Promise<boolean> {
    if (!UUID.test(clientId)) return false;
    const rows = await this.sql`UPDATE clients SET hide_exam_countdown = ${hidden} WHERE id = ${clientId} RETURNING 1`;
    return rows.length > 0;
  }

  /** The student moves one of their own topics (070); skipped ones and ranges (072) stay where the owner left them. */
  async moveByStudent(clientId: string, id: string, dueOn: string): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE study_plan_items SET due_on = ${dueOn}, updated_at = now(), student_changed_at = now()
      WHERE id = ${id} AND client_id = ${clientId} AND status <> 'skipped' AND start_on IS NULL
      RETURNING 1
    `;
    return rows.length > 0;
  }

  /** The student ticks (or unticks) one of their own topics: planned ↔ done only, never skipped. */
  async setDoneByStudent(clientId: string, id: string, done: boolean): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE study_plan_items SET status = ${done ? "done" : "planned"}, updated_at = now(), student_changed_at = now()
      WHERE id = ${id} AND client_id = ${clientId} AND status = ${done ? "planned" : "done"}
      RETURNING 1
    `;
    return rows.length > 0;
  }

  async add(clientId: string, items: readonly StudyPlanInput[]): Promise<void> {
    if (!UUID.test(clientId) || items.length === 0) return;
    await this.sql.transaction(
      items.map(
        (i) => this.sql`
          INSERT INTO study_plan_items (client_id, start_on, due_on, topic, status, note, material_url, mock_id)
          VALUES (${clientId}, ${i.startOn}, ${i.dueOn}, ${i.topic}, ${i.status}, ${i.note}, ${i.materialUrl}, ${i.mockId})
        `,
      ),
    );
  }

  async update(clientId: string, id: string, input: StudyPlanInput): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(id)) return;
    await this.sql`
      UPDATE study_plan_items SET start_on = ${input.startOn}, due_on = ${input.dueOn}, mock_id = ${input.mockId}, topic = ${input.topic}, status = ${input.status},
        note = ${input.note}, material_url = ${input.materialUrl}, updated_at = now(), student_changed_at = NULL
      WHERE id = ${id} AND client_id = ${clientId}
    `;
  }

  async remove(clientId: string, id: string): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(id)) return;
    await this.sql`DELETE FROM study_plan_items WHERE id = ${id} AND client_id = ${clientId}`;
  }
}
