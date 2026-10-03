import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { TestimonialSubmission } from "../services/TestimonialContract";
import type { Testimonial, TestimonialRecord, TestimonialStatus } from "../types";

/** Persistence for testimonials. Implemented by Postgres; faked in tests. */
export interface TestimonialStore {
  approved(): Promise<Testimonial[]>;
  list(status: TestimonialStatus): Promise<TestimonialRecord[]>;
  counts(): Promise<Record<TestimonialStatus, number>>;
  create(submission: TestimonialSubmission, consentAt: Date): Promise<{ id: string; status: TestimonialStatus }>;
  setStatus(id: string, status: TestimonialStatus): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}

interface TestimonialRow {
  id: string;
  author: string;
  email: string;
  context: string;
  program: string;
  quote: string;
  outcome: string | null;
  status: TestimonialStatus;
  consent_at: Date;
  submitted_at: Date;
  reviewed_at: Date | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres-backed store. Schema: scripts/db/migrations. */
export class TestimonialRepository implements TestimonialStore {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): TestimonialRepository | null {
    const sql = Database.sql();
    return sql ? new TestimonialRepository(sql) : null;
  }

  async approved(): Promise<Testimonial[]> {
    const rows = (await this.sql`
      SELECT id, author, context, program, quote, outcome
      FROM testimonials
      WHERE status = 'approved'
      ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC
    `) as Pick<TestimonialRow, "id" | "author" | "context" | "program" | "quote" | "outcome">[];
    return rows.map((row) => ({
      id: row.id,
      author: row.author,
      context: row.context,
      program: row.program,
      quote: row.quote,
      ...(row.outcome ? { outcome: row.outcome } : {}),
    }));
  }

  async list(status: TestimonialStatus): Promise<TestimonialRecord[]> {
    const rows = (await this.sql`
      SELECT * FROM testimonials
      WHERE status = ${status}
      ORDER BY submitted_at DESC
      LIMIT 200
    `) as TestimonialRow[];
    return rows.map(TestimonialRepository.toRecord);
  }

  async counts(): Promise<Record<TestimonialStatus, number>> {
    const rows = (await this.sql`
      SELECT status, count(*)::int AS n FROM testimonials GROUP BY status
    `) as { status: TestimonialStatus; n: number }[];
    const counts = { pending: 0, approved: 0, rejected: 0 };
    for (const row of rows) counts[row.status] = row.n;
    return counts;
  }

  async create(submission: TestimonialSubmission, consentAt: Date) {
    const [row] = (await this.sql`
      INSERT INTO testimonials (author, email, context, program, quote, outcome, consent_at)
      VALUES (${submission.author}, ${submission.email}, ${submission.context}, ${submission.program},
              ${submission.quote}, ${submission.outcome}, ${consentAt.toISOString()})
      RETURNING id, status
    `) as { id: string; status: TestimonialStatus }[];
    return row;
  }

  async setStatus(id: string, status: TestimonialStatus): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const reviewedAt = status === "pending" ? null : new Date().toISOString();
    const rows = await this.sql`
      UPDATE testimonials
      SET status = ${status}, reviewed_at = ${reviewedAt}
      WHERE id = ${id}
      RETURNING id
    `;
    return rows.length > 0;
  }

  async remove(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`DELETE FROM testimonials WHERE id = ${id} RETURNING id`;
    return rows.length > 0;
  }

  private static toRecord(row: TestimonialRow): TestimonialRecord {
    return {
      id: row.id,
      author: row.author,
      email: row.email,
      context: row.context,
      program: row.program,
      quote: row.quote,
      ...(row.outcome ? { outcome: row.outcome } : {}),
      status: row.status,
      consentAt: new Date(row.consent_at).toISOString(),
      submittedAt: new Date(row.submitted_at).toISOString(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    };
  }
}
