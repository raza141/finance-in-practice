import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Difficulty, Question, QuestionInput, QuestionOption, QuestionSummary, QuestionSwitch } from "../types";

interface QuestionRow {
  id: string;
  code: string;
  level: number;
  topic: string;
  subtopic: string;
  difficulty: Difficulty;
  slug: string;
  title: string;
  description: string;
  stem: string;
  options: QuestionOption[];
  correct: number;
  formula: string;
  solution: string;
  trap: string;
  insight: string;
  image_url: string | null;
  image_alt: string;
  source: string;
  publish_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

type SummaryRow = Pick<QuestionRow, "code" | "level" | "topic" | "slug" | "title" | "difficulty"> & { publish_at: Date };

/** Postgres-backed question bank (migration 045_cfa_questions). "Live" means publish_at has passed. */
export class QuestionRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): QuestionRepository | null {
    const sql = Database.sql();
    return sql ? new QuestionRepository(sql) : null;
  }

  async switches(): Promise<QuestionSwitch> {
    const [row] = (await this.sql`SELECT pages_on, emails_on FROM cfa_question_switch WHERE id = 1`) as { pages_on: boolean; emails_on: boolean }[];
    return { pagesOn: row?.pages_on ?? false, emailsOn: row?.emails_on ?? false };
  }

  async setSwitch(name: "pages" | "emails", on: boolean): Promise<void> {
    if (name === "pages") await this.sql`UPDATE cfa_question_switch SET pages_on = ${on}, updated_at = now() WHERE id = 1`;
    else await this.sql`UPDATE cfa_question_switch SET emails_on = ${on}, updated_at = now() WHERE id = 1`;
  }

  /** The question of the day: the most recent one whose publish time has passed. */
  async latest(): Promise<Question | null> {
    const [row] = (await this.sql`SELECT * FROM cfa_questions WHERE publish_at <= now() ORDER BY publish_at DESC LIMIT 1`) as QuestionRow[];
    return row ? QuestionRepository.toQuestion(row) : null;
  }

  async liveBySlug(topic: string, slug: string): Promise<Question | null> {
    const [row] = (await this.sql`
      SELECT * FROM cfa_questions WHERE topic = ${topic} AND slug = ${slug} AND publish_at <= now()
    `) as QuestionRow[];
    return row ? QuestionRepository.toQuestion(row) : null;
  }

  /** Live questions, newest first; one topic or all. */
  async liveSummaries(topic?: string): Promise<QuestionSummary[]> {
    const rows = (await this.sql`
      SELECT code, level, topic, slug, title, difficulty, publish_at FROM cfa_questions
      WHERE publish_at <= now() AND (${topic ?? null}::text IS NULL OR topic = ${topic ?? null})
      ORDER BY publish_at DESC
    `) as SummaryRow[];
    return rows.map(QuestionRepository.toSummary);
  }

  /** Up to `limit` other live questions, same topic first, then the newest elsewhere. */
  async related(q: Pick<Question, "id" | "topic">, limit = 3): Promise<QuestionSummary[]> {
    const rows = (await this.sql`
      SELECT code, level, topic, slug, title, difficulty, publish_at FROM cfa_questions
      WHERE publish_at <= now() AND id <> ${q.id}
      ORDER BY (topic = ${q.topic}) DESC, publish_at DESC
      LIMIT ${limit}
    `) as SummaryRow[];
    return rows.map(QuestionRepository.toSummary);
  }

  /** Admin list: everything, scheduled and drafts first. */
  async all(): Promise<Question[]> {
    const rows = (await this.sql`
      SELECT * FROM cfa_questions ORDER BY publish_at DESC NULLS FIRST, created_at DESC
    `) as QuestionRow[];
    return rows.map(QuestionRepository.toQuestion);
  }

  async byId(id: string): Promise<Question | null> {
    const [row] = (await this.sql`SELECT * FROM cfa_questions WHERE id = ${id}`) as QuestionRow[];
    return row ? QuestionRepository.toQuestion(row) : null;
  }

  async create(q: QuestionInput): Promise<string> {
    const prefix = QuestionRepository.codePrefix(q);
    const [row] = (await this.sql`
      INSERT INTO cfa_questions (code, level, topic, subtopic, difficulty, slug, title, description, stem, options, correct,
                                 formula, solution, trap, insight, image_url, image_alt, source, publish_at)
      VALUES (
        (SELECT ${prefix} || lpad((coalesce(max(substring(code, ${prefix.length + 1})::int), 0) + 1)::text, 3, '0')
           FROM cfa_questions WHERE code LIKE ${`${prefix}%`}),
        ${q.level}, ${q.topic}, ${q.subtopic}, ${q.difficulty}, ${q.slug}, ${q.title}, ${q.description}, ${q.stem},
        ${JSON.stringify(q.options)}::jsonb, ${q.correct}, ${q.formula}, ${q.solution}, ${q.trap}, ${q.insight}, ${q.imageUrl}, ${q.imageAlt},
        ${q.source}, ${q.publishAt}
      )
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /** The code follows level and topic while it is still a draft; the caller locks those once live. */
  async update(id: string, q: QuestionInput): Promise<void> {
    const prefix = QuestionRepository.codePrefix(q);
    await this.sql`
      UPDATE cfa_questions SET
        code = CASE WHEN code LIKE ${`${prefix}%`} THEN code ELSE
          (SELECT ${prefix} || lpad((coalesce(max(substring(c.code, ${prefix.length + 1})::int), 0) + 1)::text, 3, '0')
             FROM cfa_questions c WHERE c.code LIKE ${`${prefix}%`}) END,
        level = ${q.level}, topic = ${q.topic}, subtopic = ${q.subtopic}, difficulty = ${q.difficulty}, slug = ${q.slug},
        title = ${q.title}, description = ${q.description}, stem = ${q.stem}, options = ${JSON.stringify(q.options)}::jsonb,
        correct = ${q.correct}, formula = ${q.formula}, solution = ${q.solution}, trap = ${q.trap}, insight = ${q.insight}, image_url = ${q.imageUrl},
        image_alt = ${q.imageAlt}, source = ${q.source}, publish_at = ${q.publishAt}, updated_at = now()
      WHERE id = ${id}
    `;
  }

  async remove(id: string): Promise<void> {
    await this.sql`DELETE FROM cfa_questions WHERE id = ${id}`;
  }

  /**
   * Claims the question to email today: live within the last day and never emailed.
   * Marked before sending, so a retried cron can't email it twice.
   */
  async claimForEmail(): Promise<Question | null> {
    const [row] = (await this.sql`
      UPDATE cfa_questions SET emailed_at = now()
      WHERE id = (
        SELECT id FROM cfa_questions
        WHERE emailed_at IS NULL AND publish_at <= now() AND publish_at > now() - interval '1 day'
        ORDER BY publish_at DESC LIMIT 1
      )
      RETURNING *
    `) as QuestionRow[];
    return row ? QuestionRepository.toQuestion(row) : null;
  }

  /** "FIP-CFA-L1-FI-". */
  static codePrefix(q: Pick<QuestionInput, "level" | "topic">): string {
    return `FIP-CFA-L${q.level}-${QuestionTaxonomy.topic(q.topic)?.code ?? "GEN"}-`;
  }

  private static toQuestion(r: QuestionRow): Question {
    return {
      id: r.id,
      code: r.code,
      level: r.level as 1 | 2 | 3,
      topic: r.topic,
      subtopic: r.subtopic,
      difficulty: r.difficulty,
      slug: r.slug,
      title: r.title,
      description: r.description,
      stem: r.stem,
      options: r.options,
      correct: r.correct,
      formula: r.formula,
      solution: r.solution,
      trap: r.trap,
      insight: r.insight,
      imageUrl: r.image_url,
      imageAlt: r.image_alt,
      source: r.source,
      publishAt: r.publish_at,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private static toSummary(r: SummaryRow): QuestionSummary {
    return { code: r.code, level: r.level, topic: r.topic, slug: r.slug, title: r.title, difficulty: r.difficulty, publishAt: r.publish_at };
  }
}
