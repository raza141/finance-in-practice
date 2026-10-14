import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { StudyPlanInput, StudyPlanItem, StudyStatus } from "../types";

interface ItemRow {
  id: string;
  due_on: string | null;
  topic: string;
  status: StudyStatus;
  note: string;
  material_url: string | null;
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
      SELECT id, due_on::text AS due_on, topic, status, note, material_url FROM study_plan_items
      WHERE client_id = ${clientId}
      ORDER BY due_on NULLS LAST, created_at
    `) as ItemRow[];
    return rows.map((r) => ({ id: r.id, dueOn: r.due_on, topic: r.topic, status: r.status, note: r.note, materialUrl: r.material_url }));
  }

  async add(clientId: string, items: readonly StudyPlanInput[]): Promise<void> {
    if (!UUID.test(clientId) || items.length === 0) return;
    await this.sql.transaction(
      items.map(
        (i) => this.sql`
          INSERT INTO study_plan_items (client_id, due_on, topic, status, note, material_url)
          VALUES (${clientId}, ${i.dueOn}, ${i.topic}, ${i.status}, ${i.note}, ${i.materialUrl})
        `,
      ),
    );
  }

  async update(clientId: string, id: string, input: StudyPlanInput): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(id)) return;
    await this.sql`
      UPDATE study_plan_items SET due_on = ${input.dueOn}, topic = ${input.topic}, status = ${input.status},
        note = ${input.note}, material_url = ${input.materialUrl}, updated_at = now()
      WHERE id = ${id} AND client_id = ${clientId}
    `;
  }

  async remove(clientId: string, id: string): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(id)) return;
    await this.sql`DELETE FROM study_plan_items WHERE id = ${id} AND client_id = ${clientId}`;
  }
}
