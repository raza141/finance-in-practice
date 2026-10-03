import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { TestimonialSubmission } from "../services/TestimonialContract";
import type { OrderFill, OrderSide, Testimonial, TestimonialRecord, TestimonialStatus, Ticker, TickerQuote } from "../types";

/** Persistence for testimonials. Implemented by Postgres; faked in tests. */
export interface TestimonialStore {
  approved(): Promise<Testimonial[]>;
  tickerQuotes(): Promise<TickerQuote[]>;
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
  program: string | null;
  quote: string;
  outcome: string | null;
  side: OrderSide | null;
  ticker: Ticker | null;
  conviction: number | null;
  before_score: number | null;
  after_score: number | null;
  /** numeric comes back from the driver as a string. */
  yield_percent: string | null;
  status: TestimonialStatus;
  consent_at: Date;
  submitted_at: Date;
  reviewed_at: Date | null;
}

type PublicRow = Omit<TestimonialRow, "email" | "status" | "consent_at" | "submitted_at" | "reviewed_at">;

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
      SELECT id, author, context, program, quote, outcome,
             side, ticker, conviction, before_score, after_score, yield_percent
      FROM testimonials
      WHERE status = 'approved'
      ORDER BY reviewed_at DESC NULLS LAST, submitted_at DESC
      LIMIT 100
    `) as PublicRow[];
    return rows.map(TestimonialRepository.toTestimonial);
  }

  /** Average yield per ticker over approved order-book testimonials. */
  async tickerQuotes(): Promise<TickerQuote[]> {
    const rows = (await this.sql`
      SELECT ticker, avg(yield_percent)::float8 AS avg_yield, count(*)::int AS fills
      FROM testimonials
      WHERE status = 'approved' AND ticker IS NOT NULL
      GROUP BY ticker
      ORDER BY fills DESC, ticker
    `) as { ticker: Ticker; avg_yield: number; fills: number }[];
    return rows.map((row) => ({
      ticker: row.ticker,
      avgYieldPercent: Math.round(row.avg_yield * 100) / 100,
      fills: row.fills,
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
      INSERT INTO testimonials (author, email, context, quote, side, ticker, conviction,
                                before_score, after_score, consent_at)
      VALUES (${submission.author}, ${submission.email}, ${submission.context}, ${submission.quote},
              ${submission.side}, ${submission.ticker}, ${submission.conviction},
              ${submission.beforeScore}, ${submission.afterScore}, ${consentAt.toISOString()})
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

  private static toTestimonial(row: PublicRow): Testimonial {
    return {
      id: row.id,
      author: row.author,
      context: row.context,
      quote: row.quote,
      fill: TestimonialRepository.toFill(row),
      ...(row.program ? { program: row.program } : {}),
      ...(row.outcome ? { outcome: row.outcome } : {}),
    };
  }

  /** The ledger fields, or null for a pre-004 testimonial (the CHECK makes them all-or-nothing). */
  private static toFill(row: PublicRow): OrderFill | null {
    if (row.side === null || row.ticker === null || row.yield_percent === null) return null;
    return {
      side: row.side,
      ticker: row.ticker,
      conviction: Number(row.conviction),
      beforeScore: Number(row.before_score),
      afterScore: Number(row.after_score),
      yieldPercent: Number(row.yield_percent),
    };
  }

  private static toRecord(row: TestimonialRow): TestimonialRecord {
    return {
      ...TestimonialRepository.toTestimonial(row),
      email: row.email,
      status: row.status,
      consentAt: new Date(row.consent_at).toISOString(),
      submittedAt: new Date(row.submitted_at).toISOString(),
      reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    };
  }
}
