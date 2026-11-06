import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type {
  AccessGrant,
  AccessGrantInput,
  ActiveQuestion,
  AttemptStatus,
  AttemptSummary,
  CfaLevel,
  Confidence,
  ExpiredGrant,
  MockAttempt,
  MockAccess,
  MockActivityRow,
  MockAssignment,
  MockAudience,
  MockExam,
  MockExamInput,
  MockGrade,
  MockQuestion,
  MockQuestionInput,
  MockResponse,
  MockStudent,
  MockType,
  OptionLetter,
  PoolQuestion,
  QuestionUsage,
  TopicMark,
} from "../types";
import { MockContract, type PoolPick } from "../services/MockContract";
import type { NotebookRow } from "../services/MockNotebook";
import { MockGrader } from "../services/MockGrader";

interface ExamRow {
  id: string;
  title: string;
  mock_type: MockType;
  source: string;
  duration_minutes: number;
  level: CfaLevel;
  published: boolean;
  audience: MockAudience;
  courses: string[];
  created_at: Date;
  question_count: number;
  attempted: boolean;
}

interface ActiveRow {
  id: string;
  number: number;
  topic: string;
  vignette: string;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
}

type QuestionRow = ActiveRow & { correct: OptionLetter; explanation: string; why_a: string; why_b: string; why_c: string };

type BankRow = QuestionRow & { chapter: string; usage: QuestionUsage; level: CfaLevel; retired: boolean; locked: boolean; used_in: string[] };

interface AttemptRow {
  id: string;
  client_id: string;
  mock_id: string;
  started_at: Date;
  ends_at: Date;
  submitted_at: Date | null;
  score: number | null;
  total: number;
  status: AttemptStatus;
  session: number;
  break_until: Date | null;
  paused_at: Date | null;
  question_ids: string[] | null;
  screen: string | null;
}

/**
 * Postgres-backed mock exams (migrations 055, 060): the bank is mock_questions, and mock_items says which
 * questions an assessment uses. Identical rows share a content_key and act as one bank question.
 * Every student read checks the attempt is theirs.
 */
export class MockRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): MockRepository | null {
    const sql = Database.sql();
    return sql ? new MockRepository(sql) : null;
  }

  // --- Admin ---

  async all(): Promise<MockExam[]> {
    const rows = (await this.sql`
      SELECT e.*, (SELECT count(*)::int FROM mock_items i WHERE i.mock_id = e.id) AS question_count,
             EXISTS (SELECT 1 FROM mock_attempts a WHERE a.mock_id = e.id) AS attempted
      FROM mock_exams e WHERE e.owner_client IS NULL ORDER BY e.created_at DESC
    `) as ExamRow[];
    return rows.map(MockRepository.toExam);
  }

  async byId(id: string): Promise<MockExam | null> {
    const [row] = (await this.sql`
      SELECT e.*, (SELECT count(*)::int FROM mock_items i WHERE i.mock_id = e.id) AS question_count,
             EXISTS (SELECT 1 FROM mock_attempts a WHERE a.mock_id = e.id) AS attempted
      FROM mock_exams e WHERE e.id = ${id}
    `) as ExamRow[];
    return row ? MockRepository.toExam(row) : null;
  }

  async create(m: MockExamInput): Promise<string> {
    const [row] = (await this.sql`
      INSERT INTO mock_exams (title, mock_type, source, duration_minutes, level)
      VALUES (${m.title}, ${m.mockType}, ${m.source}, ${m.durationMinutes}, ${m.level})
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /** A new duration applies to attempts started from now on (open ones keep their end time). */
  async update(id: string, m: MockExamInput): Promise<void> {
    await this.sql`
      UPDATE mock_exams SET title = ${m.title}, mock_type = ${m.mockType}, source = ${m.source}, duration_minutes = ${m.durationMinutes}, level = ${m.level}
      WHERE id = ${id}
    `;
  }

  async setPublished(id: string, on: boolean): Promise<void> {
    await this.sql`UPDATE mock_exams e SET published = ${on} WHERE e.id = ${id} AND (NOT ${on} OR EXISTS (SELECT 1 FROM mock_items i WHERE i.mock_id = e.id))`;
  }

  /** False when students have sat it (the attempts keep it), unless `withAttempts`: their attempts and results go too. */
  async remove(id: string, withAttempts = false): Promise<boolean> {
    const [, rows] = await this.sql.transaction([
      withAttempts ? this.sql`DELETE FROM mock_attempts WHERE mock_id = ${id}` : this.sql`SELECT 1`,
      this.sql`DELETE FROM mock_exams WHERE id = ${id} AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${id}) RETURNING id`,
    ]);
    return (rows as unknown[]).length > 0;
  }

  /** The clients with a live grant to this one mock. */
  async accessClients(mockId: string): Promise<string[]> {
    const rows = (await this.sql`
      SELECT DISTINCT client_id FROM access_grants WHERE mock_id = ${mockId} AND (ends_at IS NULL OR ends_at > now())
    `) as { client_id: string }[];
    return rows.map((r) => r.client_id);
  }

  /** Every client this mock is open to now, grants of the whole product included (same rule as `start`). */
  async openClients(mockId: string): Promise<string[]> {
    const rows = (await this.sql`SELECT c.id FROM clients c CROSS JOIN mock_exams e WHERE e.id = ${mockId} AND mock_open_to(e, c.id)`) as { id: string }[];
    return rows.map((r) => r.id);
  }

  /** Clients who can sign in to the portal (they have a course), for the access form. */
  async students(): Promise<MockStudent[]> {
    return (await this.sql`
      SELECT id, name, email, courses FROM clients WHERE cardinality(courses) > 0 ORDER BY lower(name) LIMIT 1000
    `) as MockStudent[];
  }

  /**
   * Grant-only: a newly ticked client gets a grant, an unticked one's ends, and anyone unchanged keeps their
   * dates. Other audiences leave grants alone. A purchase is never touched.
   */
  async setAccess(mockId: string, access: MockAccess): Promise<void> {
    const update = this.sql`UPDATE mock_exams SET audience = ${access.audience}, courses = ${access.courses}::text[] WHERE id = ${mockId}`;
    if (access.audience !== "clients") {
      await update;
      return;
    }
    await this.sql.transaction([
      update,
      this.sql`DELETE FROM access_grants WHERE mock_id = ${mockId} AND source = 'admin' AND client_id <> ALL(${access.clients}::uuid[]) AND starts_at >= now()`,
      this.sql`
        UPDATE access_grants SET ends_at = now()
        WHERE mock_id = ${mockId} AND source = 'admin' AND client_id <> ALL(${access.clients}::uuid[]) AND (ends_at IS NULL OR ends_at > now())
      `,
      this.sql`
        INSERT INTO access_grants (client_id, mock_id, ends_at)
        SELECT c.id, ${mockId}::uuid, ${access.endsAt}::timestamptz FROM clients c
        WHERE c.id = ANY(${access.clients}::uuid[]) AND NOT EXISTS (
          SELECT 1 FROM access_grants g WHERE g.mock_id = ${mockId} AND g.client_id = c.id AND (g.ends_at IS NULL OR g.ends_at > now())
        )
      `,
    ]);
  }

  /** Clients holding open access to one mock now (any source). */
  async grantees(mockId: string): Promise<Set<string>> {
    const rows = (await this.sql`SELECT client_id FROM access_grants WHERE mock_id = ${mockId} AND (ends_at IS NULL OR ends_at > now())`) as { client_id: string }[];
    return new Set(rows.map((r) => r.client_id));
  }

  /** Everything granted to one client, current first. */
  async grants(clientId: string): Promise<AccessGrant[]> {
    const rows = (await this.sql`
      SELECT g.id, g.product, g.mock_id, e.title, g.starts_at, g.ends_at, g.source
      FROM access_grants g LEFT JOIN mock_exams e ON e.id = g.mock_id
      WHERE g.client_id = ${clientId}
      ORDER BY g.ends_at IS NOT NULL AND g.ends_at <= now(), g.created_at DESC
    `) as { id: string; product: AccessGrant["product"]; mock_id: string | null; title: string | null; starts_at: Date; ends_at: Date | null; source: AccessGrant["source"] }[];
    return rows.map(
      (r) => ({ id: r.id, product: r.product, mockId: r.mock_id, mockTitle: r.title, startsAt: r.starts_at, endsAt: r.ends_at, source: r.source }) as AccessGrant,
    );
  }

  async addGrant(clientId: string, g: AccessGrantInput): Promise<void> {
    await this.sql`
      INSERT INTO access_grants (client_id, product, mock_id, starts_at, ends_at)
      VALUES (${clientId}, ${g.product}, ${g.mockId}, ${g.startsAt}, ${g.endsAt})
    `;
  }

  /** Ends access now; the row stays as the record. A grant that hasn't started yet goes, as ends_at must follow starts_at. */
  async endGrant(clientId: string, grantId: string): Promise<void> {
    await this.sql.transaction([
      this.sql`DELETE FROM access_grants WHERE id = ${grantId} AND client_id = ${clientId} AND starts_at >= now()`,
      this.sql`UPDATE access_grants SET ends_at = now() WHERE id = ${grantId} AND client_id = ${clientId} AND (ends_at IS NULL OR ends_at > now())`,
    ]);
  }

  // --- The owner's activity page (drills, owner_client set, left out) ---

  /** Every open attempt, and those closed in the last 30 days or not yet seen; newest first. */
  async activity(): Promise<MockActivityRow[]> {
    const rows = (await this.sql`
      SELECT * FROM (
        SELECT a.id, a.client_id, c.name AS client_name, e.title, a.started_at, a.ends_at, a.submitted_at, a.paused_at,
          a.score, a.total, a.status, a.seen_at,
          a.question_ids IS NOT NULL OR row_number() OVER (PARTITION BY a.client_id, a.mock_id ORDER BY a.started_at) > 1 AS retake
        FROM mock_attempts a JOIN mock_exams e ON e.id = a.mock_id JOIN clients c ON c.id = a.client_id
        WHERE e.owner_client IS NULL
      ) x
      WHERE status = 'in_progress' OR seen_at IS NULL OR submitted_at > now() - interval '30 days'
      ORDER BY COALESCE(submitted_at, started_at) DESC
      LIMIT 500
    `) as (Omit<AttemptRow, "mock_id" | "session" | "break_until" | "question_ids"> & { client_name: string; title: string; seen_at: Date | null; retake: boolean })[];
    return rows.map((r) => ({
      attemptId: r.id,
      clientId: r.client_id,
      clientName: r.client_name,
      mockTitle: r.title,
      startedAt: r.started_at,
      endsAt: r.ends_at,
      submittedAt: r.submitted_at,
      pausedAt: r.paused_at,
      score: r.score,
      total: r.total,
      status: r.status,
      retake: r.retake,
      seen: r.seen_at !== null,
    }));
  }

  /** Published mocks open to a portal student (same rule as `start`) that they haven't started. */
  async assignments(): Promise<MockAssignment[]> {
    const rows = (await this.sql`
      SELECT e.id AS mock_id, e.title, c.id AS client_id, c.name,
        (SELECT max(g.ends_at) FROM access_grants g WHERE g.client_id = c.id AND g.mock_id = e.id AND (g.ends_at IS NULL OR g.ends_at > now())) AS ends_at
      FROM mock_exams e CROSS JOIN clients c
      WHERE e.published AND e.owner_client IS NULL AND cardinality(c.courses) > 0 AND mock_open_to(e, c.id)
        AND EXISTS (SELECT 1 FROM mock_items i WHERE i.mock_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM mock_attempts a WHERE a.mock_id = e.id AND a.client_id = c.id)
      ORDER BY e.created_at DESC, lower(c.name)
      LIMIT 2000
    `) as { mock_id: string; title: string; client_id: string; name: string; ends_at: Date | null }[];
    return rows.map((r) => ({ mockId: r.mock_id, mockTitle: r.title, clientId: r.client_id, clientName: r.name, endsAt: r.ends_at }));
  }

  /** Grants that ended in the last 60 days. */
  async expiredGrants(): Promise<ExpiredGrant[]> {
    const rows = (await this.sql`
      SELECT g.client_id, c.name, g.product, e.title, g.ends_at
      FROM access_grants g JOIN clients c ON c.id = g.client_id LEFT JOIN mock_exams e ON e.id = g.mock_id
      WHERE g.ends_at <= now() AND g.ends_at > now() - interval '60 days' AND e.owner_client IS NULL
      ORDER BY g.ends_at DESC LIMIT 200
    `) as { client_id: string; name: string; product: AccessGrant["product"]; title: string | null; ends_at: Date }[];
    return rows.map((r) => ({
      clientId: r.client_id,
      clientName: r.name,
      target: r.title ?? (r.product === "practice" ? "All practice sets" : "All mocks"),
      endedAt: r.ends_at,
    }));
  }

  /** Published grant-only mocks nobody can open any more: every grant has ended. */
  async openToNobody(): Promise<Pick<MockExam, "id" | "title">[]> {
    return (await this.sql`
      SELECT e.id, e.title FROM mock_exams e
      WHERE e.published AND e.owner_client IS NULL AND e.audience = 'clients'
        AND EXISTS (SELECT 1 FROM access_grants g WHERE g.mock_id = e.id)
        AND NOT EXISTS (SELECT 1 FROM clients c WHERE mock_open_to(e, c.id))
      ORDER BY e.title
    `) as Pick<MockExam, "id" | "title">[];
  }

  /** Marks finished attempts seen: the ones given, or all when `ids` is null. */
  async markSeen(ids: string[] | null): Promise<void> {
    await this.sql`
      UPDATE mock_attempts SET seen_at = now()
      WHERE status = 'completed' AND seen_at IS NULL AND (${ids}::uuid[] IS NULL OR id = ANY(${ids}::uuid[]))
    `;
  }

  // --- The question bank ---

  /** Topic names already used, so a new question can reuse the spelling (Progress and the bank group by it). */
  async topicNames(): Promise<string[]> {
    const rows = (await this.sql`SELECT DISTINCT ON (lower(trim(topic))) trim(topic) AS topic FROM mock_questions ORDER BY lower(trim(topic))`) as { topic: string }[];
    return rows.map((r) => r.topic);
  }

  /** Topics with active questions, per level: what a topic test can draw from. */
  async topicLevels(): Promise<{ topic: string; level: CfaLevel }[]> {
    return (await this.sql`
      SELECT DISTINCT ON (lower(trim(topic)), level) trim(topic) AS topic, level FROM mock_questions WHERE NOT retired ORDER BY lower(trim(topic)), level
    `) as { topic: string; level: CfaLevel }[];
  }

  async chapterNames(): Promise<string[]> {
    const rows = (await this.sql`
      SELECT DISTINCT ON (lower(trim(chapter))) trim(chapter) AS chapter FROM mock_questions WHERE chapter <> '' ORDER BY lower(trim(chapter))
    `) as { chapter: string }[];
    return rows.map((r) => r.chapter);
  }

  /**
   * Every bank question, or with `mock` only what can still go into it: active, the right usage, and not
   * already in it. Topics are matched ignoring case and spaces at the ends, as Progress matches them.
   * `avoid` leaves out what those clients have met: anything in an assessment they've started, under any copy.
   * `level` keeps to one CFA level (a mock's own, when given); null: every level.
   */
  async pool(mock?: Pick<MockExam, "id" | "mockType" | "level">, avoid: string[] = [], level: CfaLevel | null = mock?.level ?? null): Promise<PoolQuestion[]> {
    const usages = mock ? MockContract.usages(mock.mockType) : [];
    const rows = (await this.sql`
      SELECT DISTINCT ON (q.content_key) q.id, COALESCE(q.number, 0) AS number, q.topic, q.chapter, q.usage, q.level, q.retired, q.vignette, q.question,
        q.option_a, q.option_b, q.option_c, q.correct, q.explanation, q.why_a, q.why_b, q.why_c,
        EXISTS (
          SELECT 1 FROM mock_questions s JOIN mock_items i ON i.question_id = s.id JOIN mock_attempts a ON a.mock_id = i.mock_id WHERE s.content_key = q.content_key
        ) AS locked,
        ARRAY(
          SELECT DISTINCT e.title FROM mock_questions s JOIN mock_items i ON i.question_id = s.id JOIN mock_exams e ON e.id = i.mock_id WHERE s.content_key = q.content_key
        ) AS used_in
      FROM mock_questions q
      WHERE (${mock?.id ?? null}::uuid IS NULL OR (
        NOT q.retired AND q.usage = ANY(${usages}::text[])
        AND q.content_key NOT IN (SELECT s.content_key FROM mock_items i JOIN mock_questions s ON s.id = i.question_id WHERE i.mock_id = ${mock?.id ?? null}::uuid)
      ))
        AND q.content_key NOT IN (SELECT s.content_key FROM mock_attempts a JOIN mock_items i ON i.mock_id = a.mock_id JOIN mock_questions s ON s.id = i.question_id WHERE a.client_id = ANY(${avoid}::uuid[]))
        AND (${level}::smallint IS NULL OR q.level = ${level}::smallint)
      ORDER BY q.content_key, q.id
    `) as BankRow[];
    return rows
      .map(MockRepository.toBank)
      .sort((a, b) => a.topic.toLowerCase().localeCompare(b.topic.toLowerCase()) || a.chapter.toLowerCase().localeCompare(b.chapter.toLowerCase()) || a.question.localeCompare(b.question));
  }

  /** One bank question by the id of any of its copies: an assessment may hold a copy `pool` doesn't list. */
  async bankQuestion(id: string): Promise<PoolQuestion | null> {
    const [row] = (await this.sql`
      SELECT q.id, COALESCE(q.number, 0) AS number, q.topic, q.chapter, q.usage, q.level, q.retired, q.vignette, q.question, q.option_a, q.option_b, q.option_c, q.correct, q.explanation, q.why_a, q.why_b, q.why_c,
        EXISTS (
          SELECT 1 FROM mock_questions s JOIN mock_items i ON i.question_id = s.id JOIN mock_attempts a ON a.mock_id = i.mock_id WHERE s.content_key = q.content_key
        ) AS locked,
        '{}'::text[] AS used_in
      FROM mock_questions q WHERE q.id = ${id}
    `) as BankRow[];
    return row ? MockRepository.toBank(row) : null;
  }

  /** Uploads to the bank, leaving out questions it already has (also repeats within the sheet). */
  async importQuestions(questions: MockQuestionInput[]): Promise<{ added: number; skipped: number }> {
    const rows = JSON.stringify(
      questions.map((q) => ({
        // The sheet's order: a vignette set's questions are drawn in it.
        number: q.number,
        topic: q.topic,
        chapter: q.chapter,
        usage: q.usage,
        level: q.level,
        vignette: q.vignette,
        question: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        correct: q.correct,
        explanation: q.explanation,
        why_a: q.why[0],
        why_b: q.why[1],
        why_c: q.why[2],
      })),
    );
    const inserted = await this.sql`
      WITH sheet AS (
        SELECT r.*, row_number() OVER () AS at, mock_question_key(r.topic, r.vignette, r.question, r.option_a, r.option_b, r.option_c, r.correct) AS key
        FROM jsonb_to_recordset(${rows}::jsonb) AS r(number smallint, topic text, chapter text, usage text, level smallint, vignette text, question text, option_a text,
                                                     option_b text, option_c text, correct text, explanation text, why_a text, why_b text, why_c text)
      ), fresh AS (
        SELECT DISTINCT ON (key) * FROM sheet WHERE key NOT IN (SELECT content_key FROM mock_questions) ORDER BY key, at
      )
      INSERT INTO mock_questions (number, topic, chapter, usage, level, vignette, question, option_a, option_b, option_c, correct, explanation, why_a, why_b, why_c)
      SELECT number, topic, chapter, usage, level, vignette, question, option_a, option_b, option_c, correct, explanation, why_a, why_b, why_c FROM fresh
      RETURNING id
    `;
    return { added: inserted.length, skipped: questions.length - inserted.length };
  }

  /**
   * Adds (no `questionId`) or edits a bank question. Once it's in an assessment students have started, only
   * what can't move a score may change (chapter, usage, explanation): anything else is "locked". "duplicate":
   * those words and answer are already another question in the bank.
   */
  async saveQuestion(questionId: string | null, q: MockQuestionInput): Promise<"saved" | "locked" | "duplicate"> {
    const [o1, o2, o3] = q.options;
    const [w1, w2, w3] = q.why;
    const [{ taken }] = (await this.sql`
      SELECT EXISTS (
        SELECT 1 FROM mock_questions t WHERE t.content_key = mock_question_key(${q.topic}, ${q.vignette}, ${q.question}, ${o1}, ${o2}, ${o3}, ${q.correct})
          AND t.content_key IS DISTINCT FROM (SELECT content_key FROM mock_questions WHERE id = ${questionId}::uuid)
      ) AS taken
    `) as { taken: boolean }[];
    if (taken) return "duplicate";
    if (!questionId) {
      await this.sql`
        INSERT INTO mock_questions (topic, chapter, usage, level, vignette, question, option_a, option_b, option_c, correct, explanation, why_a, why_b, why_c)
        VALUES (${q.topic}, ${q.chapter}, ${q.usage}, ${q.level}, ${q.vignette}, ${q.question}, ${o1}, ${o2}, ${o3}, ${q.correct}, ${q.explanation}, ${w1}, ${w2}, ${w3})
      `;
      return "saved";
    }
    const rows = await this.sql`
      UPDATE mock_questions t SET topic = ${q.topic}, chapter = ${q.chapter}, usage = ${q.usage}, level = ${q.level}, vignette = ${q.vignette}, question = ${q.question},
        option_a = ${o1}, option_b = ${o2}, option_c = ${o3}, correct = ${q.correct}, explanation = ${q.explanation}, why_a = ${w1}, why_b = ${w2}, why_c = ${w3}
      FROM mock_questions me
      WHERE me.id = ${questionId} AND t.content_key = me.content_key AND (
        mock_question_key(${q.topic}, ${q.vignette}, ${q.question}, ${o1}, ${o2}, ${o3}, ${q.correct}) = me.content_key
        OR NOT EXISTS (
          SELECT 1 FROM mock_questions s JOIN mock_items i ON i.question_id = s.id JOIN mock_attempts a ON a.mock_id = i.mock_id WHERE s.content_key = me.content_key
        )
      )
      RETURNING t.id
    `;
    return rows.length > 0 ? "saved" : "locked";
  }

  /** False while any assessment uses it: take it out first, or retire it. */
  async deleteQuestion(questionId: string): Promise<boolean> {
    const rows = await this.sql`
      DELETE FROM mock_questions t USING mock_questions me
      WHERE me.id = ${questionId} AND t.content_key = me.content_key AND NOT EXISTS (
        SELECT 1 FROM mock_questions s JOIN mock_items i ON i.question_id = s.id WHERE s.content_key = me.content_key
      )
      RETURNING t.id
    `;
    return rows.length > 0;
  }

  /** Retired questions stay in the assessments that use them, and can't be picked again. */
  async setRetired(ids: string[], retired: boolean): Promise<void> {
    await this.sql`
      UPDATE mock_questions SET retired = ${retired}
      WHERE content_key IN (SELECT content_key FROM mock_questions WHERE id = ANY(${ids}::uuid[]))
    `;
  }

  async setUsage(ids: string[], usage: QuestionUsage): Promise<void> {
    await this.sql`
      UPDATE mock_questions SET usage = ${usage}
      WHERE content_key IN (SELECT content_key FROM mock_questions WHERE id = ANY(${ids}::uuid[]))
    `;
  }

  async setChapter(ids: string[], chapter: string): Promise<void> {
    await this.sql`
      UPDATE mock_questions SET chapter = ${chapter}
      WHERE content_key IN (SELECT content_key FROM mock_questions WHERE id = ANY(${ids}::uuid[]))
    `;
  }

  // --- An assessment's questions ---

  /**
   * Adds every ticked question, and per topic random ones until the batch has that topic's number (ticked
   * ones count towards it), after the questions it already has. Topics in the order given. The draw is by
   * vignette set (a Level II item set): a set goes in whole or not at all, so a topic may go over its
   * number by up to a set less one. Only what `pool(mock)` offers can go in, and nothing once students have started it.
   */
  async addFromBank(mock: Pick<MockExam, "id" | "mockType" | "level">, pick: PoolPick): Promise<number> {
    const quotas = JSON.stringify(pick.quotas);
    const [row] = (await this.sql`
      WITH open AS (
        SELECT COALESCE((SELECT max(number) FROM mock_items WHERE mock_id = ${mock.id}), 0) AS last
        WHERE NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mock.id})
      ), pool AS (
        SELECT DISTINCT ON (content_key) *
        FROM mock_questions
        WHERE NOT retired AND usage = ANY(${MockContract.usages(mock.mockType)}::text[]) AND level = ${mock.level}::smallint
          AND (${pick.chapter} = '' OR lower(trim(chapter)) = lower(${pick.chapter}) OR id = ANY(${pick.ids}::uuid[]))
          AND content_key NOT IN (SELECT s.content_key FROM mock_items i JOIN mock_questions s ON s.id = i.question_id WHERE i.mock_id = ${mock.id})
          AND content_key NOT IN (SELECT s.content_key FROM mock_attempts a JOIN mock_items i ON i.mock_id = a.mock_id JOIN mock_questions s ON s.id = i.question_id WHERE a.client_id = ANY(${pick.avoid}::uuid[]))
        ORDER BY content_key, id = ANY(${pick.ids}::uuid[]) DESC, random()
      ), want AS (
        SELECT lower(trim(w.e->>'topic')) AS key, (w.e->>'count')::int AS count, w.ord FROM jsonb_array_elements(${quotas}::jsonb) WITH ORDINALITY AS w(e, ord)
      ), ranked AS (
        SELECT pool.*, lower(trim(pool.topic)) AS key, COALESCE(NULLIF(pool.vignette, ''), pool.id::text) AS grp FROM pool
      ), sets AS (
        SELECT key, grp, count(*) AS size, bool_or(id = ANY(${pick.ids}::uuid[])) AS ticked, random() AS rnd FROM ranked GROUP BY key, grp
      ), drawn AS (
        SELECT key, grp, rnd, sum(size) OVER (PARTITION BY key ORDER BY ticked DESC, rnd ROWS UNBOUNDED PRECEDING) - size AS before FROM sets
      ), picked AS (
        SELECT ranked.id, row_number() OVER (ORDER BY want.ord NULLS LAST, ranked.key, drawn.rnd, ranked.number NULLS LAST, ranked.question) AS n
        FROM ranked JOIN drawn USING (key, grp) LEFT JOIN want USING (key)
        WHERE ranked.id = ANY(${pick.ids}::uuid[]) OR drawn.before < want.count
      ), added AS (
        INSERT INTO mock_items (mock_id, question_id, number)
        SELECT ${mock.id}::uuid, p.id, open.last + p.n FROM open CROSS JOIN picked p WHERE open.last + p.n <= ${MockContract.MAX_QUESTIONS}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM added
    `) as { count: number }[];
    return row.count;
  }

  /** A new draft with its questions; null, and no draft left behind, when nothing matches. */
  async buildFromBank(m: MockExamInput, pick: PoolPick): Promise<string | null> {
    const id = await this.create(m);
    if (await this.addFromBank({ id, mockType: m.mockType, level: m.level }, pick)) return id;
    await this.remove(id);
    return null;
  }

  /** Back to the bank; false once anyone has started the mock. The gap in numbers is fine: an attempt numbers its questions 1 to n. */
  async removeItem(mockId: string, questionId: string): Promise<boolean> {
    const rows = await this.sql`
      DELETE FROM mock_items WHERE mock_id = ${mockId} AND question_id = ${questionId} AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId}) RETURNING 1
    `;
    return rows.length > 0;
  }

  /** Swaps a question with its neighbour. */
  async moveItem(mockId: string, questionId: string, direction: "up" | "down"): Promise<void> {
    await this.sql`
      WITH me AS (
        SELECT number FROM mock_items WHERE mock_id = ${mockId} AND question_id = ${questionId}
          AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId})
      ), other AS (
        SELECT i.question_id, i.number FROM mock_items i, me
        WHERE i.mock_id = ${mockId} AND CASE WHEN ${direction} = 'up' THEN i.number < me.number ELSE i.number > me.number END
        ORDER BY CASE WHEN ${direction} = 'up' THEN -i.number ELSE i.number END LIMIT 1
      )
      UPDATE mock_items i SET number = CASE WHEN i.question_id = ${questionId} THEN other.number ELSE me.number END
      FROM me, other WHERE i.mock_id = ${mockId} AND i.question_id IN (${questionId}::uuid, other.question_id)
    `;
  }

  // --- Drills: a mock one student makes for themselves (owner_client), open to them only and listed nowhere ---

  /**
   * A drill of `from`: a draw from the bank (as `addFromBank`), or questions by id, kept to ones this student
   * has already answered in a closed attempt (the notebook's). `m.durationMinutes` is for all that was asked;
   * it's scaled to what went in. Null, and nothing left behind, when none go in.
   */
  async drill(clientId: string, m: MockExamInput, from: PoolPick | string[]): Promise<string | null> {
    const [{ id }] = (await this.sql`
      INSERT INTO mock_exams (title, mock_type, source, duration_minutes, level, published, audience, owner_client)
      VALUES (${m.title}, ${m.mockType}, ${m.source}, ${m.durationMinutes}, ${m.level}, true, 'clients', ${clientId})
      RETURNING id
    `) as { id: string }[];
    const added = Array.isArray(from)
      ? (
          await this.sql`
            INSERT INTO mock_items (mock_id, question_id, number)
            SELECT ${id}::uuid, x.id, row_number() OVER (ORDER BY x.ord)
            FROM unnest(${from}::uuid[]) WITH ORDINALITY AS x(id, ord)
            WHERE x.ord <= ${MockContract.MAX_QUESTIONS} AND EXISTS (
              SELECT 1 FROM mock_attempts a JOIN mock_items i ON i.mock_id = a.mock_id
              WHERE a.client_id = ${clientId} AND a.status = 'completed' AND i.question_id = x.id
            )
            RETURNING 1
          `
        ).length
      : await this.addFromBank({ id, mockType: m.mockType, level: m.level }, from);
    // The clock was set for the number asked for: fewer came back, so it shrinks to match.
    const asked = Array.isArray(from) ? from.length : from.quotas.reduce((n, q) => n + q.count, 0) + from.ids.length;
    if (added && added < asked) await this.sql`UPDATE mock_exams SET duration_minutes = ${Math.max(1, Math.ceil((m.durationMinutes * added) / asked))} WHERE id = ${id}`;
    if (added) return id;
    await this.sql`DELETE FROM mock_exams WHERE id = ${id} AND owner_client = ${clientId}`;
    return null;
  }

  /** Every answer in the student's closed attempts, oldest first: what `MockNotebook.build` reads. */
  async notebookRows(clientId: string): Promise<NotebookRow[]> {
    const rows = (await this.sql`
      SELECT q.content_key AS key, q.id, q.topic, q.level, q.vignette, q.question, q.option_a, q.option_b, q.option_c, q.correct, q.explanation,
        q.why_a, q.why_b, q.why_c, r.selected, COALESCE(r.flagged, false) AS flagged, a.submitted_at AS at
      FROM mock_attempts a
      JOIN mock_items i ON i.mock_id = a.mock_id AND (a.question_ids IS NULL OR i.question_id = ANY(a.question_ids))
      JOIN mock_questions q ON q.id = i.question_id
      LEFT JOIN mock_responses r ON r.attempt_id = a.id AND r.question_id = q.id
      WHERE a.client_id = ${clientId} AND a.status = 'completed'
      ORDER BY a.submitted_at, i.number
    `) as (QuestionRow & { key: string; level: CfaLevel; selected: OptionLetter | null; flagged: boolean; at: Date })[];
    return rows.map((r) => ({
      key: r.key,
      id: r.id,
      topic: r.topic,
      level: r.level,
      vignette: r.vignette,
      question: r.question,
      options: [r.option_a, r.option_b, r.option_c],
      correct: r.correct,
      explanation: r.explanation,
      why: [r.why_a, r.why_b, r.why_c],
      selected: r.selected,
      flagged: r.flagged,
      at: r.at,
    }));
  }

  /** The student's topics by accuracy, weakest first (at least 3 answers, same mocks as Progress). */
  async weakTopics(clientId: string): Promise<{ topic: string; level: CfaLevel; correct: number; total: number }[]> {
    return (await this.sql`
      SELECT min(trim(q.topic)) AS topic, q.level, count(*)::int AS total, count(*) FILTER (WHERE r.selected = q.correct)::int AS correct
      FROM mock_attempts a
      JOIN mock_exams e ON e.id = a.mock_id
      JOIN mock_items i ON i.mock_id = a.mock_id
      JOIN mock_questions q ON q.id = i.question_id
      LEFT JOIN mock_responses r ON r.attempt_id = a.id AND r.question_id = q.id
      WHERE a.client_id = ${clientId} AND a.status = 'completed' AND a.question_ids IS NULL AND e.owner_client IS NULL
      GROUP BY lower(trim(q.topic)), q.level
      HAVING count(*) >= 3
      ORDER BY count(*) FILTER (WHERE r.selected = q.correct)::float / count(*), count(*) DESC
    `) as { topic: string; level: CfaLevel; correct: number; total: number }[];
  }

  /** With answers and explanations: for grading and results only, never an open attempt's page. */
  async questions(mockId: string): Promise<MockQuestion[]> {
    const rows = (await this.sql`
      SELECT q.id, i.number, q.topic, q.vignette, q.question, q.option_a, q.option_b, q.option_c, q.correct, q.explanation, q.why_a, q.why_b, q.why_c
      FROM mock_items i JOIN mock_questions q ON q.id = i.question_id WHERE i.mock_id = ${mockId} ORDER BY i.number
    `) as QuestionRow[];
    return rows.map((r) => ({ ...MockRepository.toActive(r), correct: r.correct, explanation: r.explanation, why: [r.why_a, r.why_b, r.why_c] }));
  }

  // --- Students ---

  /** What the student's lobby lists: published mocks with questions that are open to them (same rule as `start`). */
  async published(clientId: string): Promise<MockExam[]> {
    const rows = (await this.sql`
      SELECT e.*, n.question_count, false AS attempted
      FROM mock_exams e
      CROSS JOIN LATERAL (SELECT count(*)::int AS question_count FROM mock_items i WHERE i.mock_id = e.id) n
      WHERE e.published AND n.question_count > 0 AND e.owner_client IS NULL AND mock_open_to(e, ${clientId}::uuid)
      ORDER BY e.created_at DESC
    `) as ExamRow[];
    return rows.map(MockRepository.toExam);
  }

  /**
   * Other students' percentages on this mock: each one's first full attempt (no retakes, no drills),
   * leaving out admin logins (test accounts). For the class average on a results page.
   */
  async classScores(mockId: string, clientId: string): Promise<number[]> {
    const rows = (await this.sql`
      SELECT DISTINCT ON (a.client_id) a.score, a.total
      FROM mock_attempts a
      JOIN mock_exams e ON e.id = a.mock_id AND e.owner_client IS NULL
      JOIN clients c ON c.id = a.client_id
      WHERE a.mock_id = ${mockId} AND a.client_id <> ${clientId} AND a.status = 'completed' AND a.question_ids IS NULL
        AND a.score IS NOT NULL AND a.total > 0
        AND NOT EXISTS (SELECT 1 FROM admin_users u WHERE lower(u.email) = lower(c.email))
      ORDER BY a.client_id, a.submitted_at
    `) as { score: number; total: number }[];
    return rows.map((r) => (r.score / r.total) * 100);
  }

  async history(clientId: string): Promise<AttemptSummary[]> {
    const rows = (await this.sql`
      SELECT a.id, a.mock_id, e.title, a.started_at, a.submitted_at, a.score, a.total, a.status, a.question_ids IS NOT NULL AS mistakes
      FROM mock_attempts a JOIN mock_exams e ON e.id = a.mock_id
      WHERE a.client_id = ${clientId} ORDER BY a.started_at DESC
    `) as (Pick<AttemptRow, "id" | "mock_id" | "started_at" | "submitted_at" | "score" | "total" | "status"> & { title: string; mistakes: boolean })[];
    return rows.map((r) => ({
      id: r.id,
      mockId: r.mock_id,
      mockTitle: r.title,
      startedAt: r.started_at,
      submittedAt: r.submitted_at,
      score: r.score,
      total: r.total,
      status: r.status,
      mistakes: r.mistakes,
    }));
  }

  /**
   * Every closed attempt's marks by topic, oldest first: what the portal's Progress tab is built from.
   * End-of-chapter sets and mistakes retakes stay out, so practice and revision don't skew it.
   */
  async topicMarks(clientId: string): Promise<TopicMark[]> {
    const rows = (await this.sql`
      SELECT a.id, e.title, a.submitted_at, q.topic, count(*)::int AS total, count(*) FILTER (WHERE r.selected = q.correct)::int AS correct
      FROM mock_attempts a
      JOIN mock_exams e ON e.id = a.mock_id
      JOIN mock_items i ON i.mock_id = a.mock_id
      JOIN mock_questions q ON q.id = i.question_id
      LEFT JOIN mock_responses r ON r.attempt_id = a.id AND r.question_id = q.id
      WHERE a.client_id = ${clientId} AND a.status = 'completed' AND e.mock_type <> 'chapter' AND a.question_ids IS NULL AND e.owner_client IS NULL
      GROUP BY a.id, e.title, a.submitted_at, q.topic
      ORDER BY a.submitted_at, a.id, min(i.number)
    `) as { id: string; title: string; submitted_at: Date; topic: string; total: number; correct: number }[];
    return rows.map((r) => ({ attemptId: r.id, title: r.title, at: r.submitted_at.toISOString(), topic: r.topic, correct: r.correct, total: r.total }));
  }

  /**
   * Starts the mock, or returns the student's open attempt at it (of either kind). Null: not published, no
   * questions, or not open to this student (same rule as `published`). An attempt already open can be finished.
   * `retake`: only those questions (a closed attempt's mistakes), on a clock of `minutes`.
   */
  async start(clientId: string, mockId: string, retake: { questionIds: string[]; minutes: number } | null = null): Promise<string | null> {
    const ids = retake?.questionIds ?? null;
    const [created] = (await this.sql`
      INSERT INTO mock_attempts (client_id, mock_id, ends_at, total, question_ids)
      SELECT ${clientId}::uuid, e.id, now() + make_interval(mins => COALESCE(${retake?.minutes ?? null}::int, e.duration_minutes)),
        COALESCE(cardinality(${ids}::uuid[]), c.n), ${ids}::uuid[]
      FROM mock_exams e
      CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM mock_items WHERE mock_id = e.id) c
      WHERE e.id = ${mockId} AND e.published AND c.n > 0 AND mock_open_to(e, ${clientId}::uuid)
        AND (${ids}::uuid[] IS NULL OR cardinality(${ids}::uuid[]) > 0 AND NOT EXISTS (
          SELECT 1 FROM unnest(${ids}::uuid[]) AS x(id) WHERE x.id NOT IN (SELECT question_id FROM mock_items WHERE mock_id = e.id)
        ))
      ON CONFLICT (client_id, mock_id) WHERE status = 'in_progress' DO NOTHING
      RETURNING id
    `) as { id: string }[];
    return created?.id ?? (await this.openAttempt(clientId, mockId))?.id ?? null;
  }

  async attempt(attemptId: string, clientId: string): Promise<MockAttempt | null> {
    const [row] = (await this.sql`SELECT * FROM mock_attempts WHERE id = ${attemptId} AND client_id = ${clientId}`) as AttemptRow[];
    return row ? MockRepository.toAttempt(row) : null;
  }

  /** The student's open attempt at a mock, if any, and whether it's a mistakes retake. */
  async openAttempt(clientId: string, mockId: string): Promise<{ id: string; mistakes: boolean } | null> {
    const [row] = (await this.sql`
      SELECT id, question_ids IS NOT NULL AS mistakes FROM mock_attempts WHERE client_id = ${clientId} AND mock_id = ${mockId} AND status = 'in_progress'
    `) as { id: string; mistakes: boolean }[];
    return row ?? null;
  }

  /** The shuffle seed for an attempt: null for the student's first go at the mock, its own id for a retake. */
  async seed(attempt: MockAttempt): Promise<string | null> {
    const [row] = (await this.sql`
      SELECT EXISTS (
        SELECT 1 FROM mock_attempts WHERE client_id = ${attempt.clientId} AND mock_id = ${attempt.mockId} AND started_at < ${attempt.startedAt}
      ) AS retake
    `) as { retake: boolean }[];
    return row.retake ? attempt.id : null;
  }

  /** The open attempt's questions. The SELECT itself leaves out the answer and the explanation. */
  async activeQuestions(mockId: string): Promise<ActiveQuestion[]> {
    const rows = (await this.sql`
      SELECT q.id, i.number, q.topic, q.vignette, q.question, q.option_a, q.option_b, q.option_c
      FROM mock_items i JOIN mock_questions q ON q.id = i.question_id WHERE i.mock_id = ${mockId} ORDER BY i.number
    `) as ActiveRow[];
    return rows.map(MockRepository.toActive);
  }

  async responses(attemptId: string): Promise<MockResponse[]> {
    const rows = (await this.sql`
      SELECT question_id, selected, flagged, notes, seconds, confidence FROM mock_responses WHERE attempt_id = ${attemptId}
    `) as { question_id: string; selected: OptionLetter | null; flagged: boolean; notes: string; seconds: number; confidence: Confidence | null }[];
    return rows.map((r) => ({ questionId: r.question_id, selected: r.selected, flagged: r.flagged, notes: r.notes, seconds: r.seconds, confidence: r.confidence }));
  }

  /**
   * Saves answers while the attempt is open, still in `session`, not on its break, and its clock
   * (plus grace) hasn't run out; false otherwise. The caller passes only that session's questions.
   */
  async autosave(attemptId: string, clientId: string, responses: MockResponse[], session: number): Promise<boolean> {
    const [row] = (await this.sql`
      WITH live AS (
        SELECT id, mock_id FROM mock_attempts
        WHERE id = ${attemptId} AND client_id = ${clientId} AND status = 'in_progress' AND session = ${session}
          AND (break_until IS NULL OR break_until <= now()) AND paused_at IS NULL
          AND now() <= ends_at + make_interval(secs => ${MockGrader.GRACE_MS / 1000})
      ), saved AS (
        INSERT INTO mock_responses (attempt_id, question_id, selected, flagged, notes, seconds, confidence)
        SELECT live.id, r.question_id, r.selected, r.flagged, r.notes, r.seconds, r.confidence
        FROM live CROSS JOIN jsonb_to_recordset(${MockRepository.json(responses)}::jsonb)
          AS r(question_id uuid, selected text, flagged boolean, notes text, seconds integer, confidence text)
        JOIN mock_items i ON i.question_id = r.question_id AND i.mock_id = live.mock_id
        ON CONFLICT (attempt_id, question_id) DO UPDATE
          SET selected = EXCLUDED.selected, flagged = EXCLUDED.flagged, notes = EXCLUDED.notes, seconds = EXCLUDED.seconds, confidence = EXCLUDED.confidence
          -- Rows that didn't change aren't rewritten: an autosave sends every question, most of them as they were.
          WHERE (mock_responses.selected, mock_responses.flagged, mock_responses.notes, mock_responses.seconds, mock_responses.confidence)
            IS DISTINCT FROM (EXCLUDED.selected, EXCLUDED.flagged, EXCLUDED.notes, EXCLUDED.seconds, EXCLUDED.confidence)
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM live
    `) as { n: number }[];
    return row.n > 0;
  }

  /**
   * Closes the attempt with its score and final answers in one statement: the answers are only
   * written if this call is the one that closed it, so a second submit changes nothing (false).
   */
  async complete(attemptId: string, clientId: string, grade: MockGrade, responses: MockResponse[]): Promise<boolean> {
    const [row] = (await this.sql`
      WITH done AS (
        UPDATE mock_attempts SET status = 'completed', submitted_at = LEAST(now(), ends_at), score = ${grade.score}
        WHERE id = ${attemptId} AND client_id = ${clientId} AND status = 'in_progress'
        RETURNING id, mock_id
      ), saved AS (
        INSERT INTO mock_responses (attempt_id, question_id, selected, flagged, notes, seconds, confidence)
        SELECT done.id, r.question_id, r.selected, r.flagged, r.notes, r.seconds, r.confidence
        FROM done CROSS JOIN jsonb_to_recordset(${MockRepository.json(responses)}::jsonb)
          AS r(question_id uuid, selected text, flagged boolean, notes text, seconds integer, confidence text)
        JOIN mock_items i ON i.question_id = r.question_id AND i.mock_id = done.mock_id
        ON CONFLICT (attempt_id, question_id) DO UPDATE
          SET selected = EXCLUDED.selected, flagged = EXCLUDED.flagged, notes = EXCLUDED.notes, seconds = EXCLUDED.seconds, confidence = EXCLUDED.confidence
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM done
    `) as { n: number }[];
    return row.n > 0;
  }

  /**
   * Closes session 1 of a full mock with its final answers: the break starts when its clock ended
   * (or now, if earlier) and session 2's clock starts when the break ends. False if already moved on.
   */
  async endSession(attemptId: string, clientId: string, responses: MockResponse[]): Promise<boolean> {
    const [row] = (await this.sql`
      WITH moved AS (
        UPDATE mock_attempts a SET session = 2,
          break_until = LEAST(now(), a.ends_at) + make_interval(mins => ${MockContract.BREAK_MINUTES}),
          ends_at = LEAST(now(), a.ends_at) + make_interval(mins => ${MockContract.BREAK_MINUTES} + e.duration_minutes)
        FROM mock_exams e
        WHERE e.id = a.mock_id AND a.id = ${attemptId} AND a.client_id = ${clientId} AND a.status = 'in_progress' AND a.session = 1
        RETURNING a.id, a.mock_id
      ), saved AS (
        INSERT INTO mock_responses (attempt_id, question_id, selected, flagged, notes, seconds, confidence)
        SELECT moved.id, r.question_id, r.selected, r.flagged, r.notes, r.seconds, r.confidence
        FROM moved CROSS JOIN jsonb_to_recordset(${MockRepository.json(responses)}::jsonb)
          AS r(question_id uuid, selected text, flagged boolean, notes text, seconds integer, confidence text)
        JOIN mock_items i ON i.question_id = r.question_id AND i.mock_id = moved.mock_id
        ON CONFLICT (attempt_id, question_id) DO UPDATE
          SET selected = EXCLUDED.selected, flagged = EXCLUDED.flagged, notes = EXCLUDED.notes, seconds = EXCLUDED.seconds, confidence = EXCLUDED.confidence
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM moved
    `) as { n: number }[];
    return row.n > 0;
  }

  /** Stops the clock while a session is running; answers aren't taken until resume. */
  async pause(attemptId: string, clientId: string): Promise<boolean> {
    const rows = await this.sql`
      UPDATE mock_attempts SET paused_at = now()
      WHERE id = ${attemptId} AND client_id = ${clientId} AND status = 'in_progress' AND paused_at IS NULL AND now() < ends_at
        AND (break_until IS NULL OR break_until <= now())
      RETURNING id
    `;
    return rows.length > 0;
  }

  /** This screen takes the open attempt over: from now on only it may save (`MockPlayerApi.taken`). */
  async claimScreen(attemptId: string, clientId: string, screen: string): Promise<void> {
    await this.sql`UPDATE mock_attempts SET screen = ${screen} WHERE id = ${attemptId} AND client_id = ${clientId} AND status = 'in_progress'`;
  }

  /** Restarts the clock with the time that was left at the pause. */
  async resume(attemptId: string, clientId: string): Promise<boolean> {
    const rows = await this.sql`
      UPDATE mock_attempts SET ends_at = ends_at + (now() - paused_at), paused_at = NULL
      WHERE id = ${attemptId} AND client_id = ${clientId} AND status = 'in_progress' AND paused_at IS NOT NULL
      RETURNING id
    `;
    return rows.length > 0;
  }

  /** Ends the break early: session 2's clock starts now. False when the break is already over. */
  async startSession(attemptId: string, clientId: string): Promise<boolean> {
    const rows = await this.sql`
      UPDATE mock_attempts a SET break_until = now(), ends_at = now() + make_interval(mins => e.duration_minutes)
      FROM mock_exams e
      WHERE e.id = a.mock_id AND a.id = ${attemptId} AND a.client_id = ${clientId} AND a.status = 'in_progress' AND a.session = 2 AND a.break_until > now()
      RETURNING a.id
    `;
    return rows.length > 0;
  }

  /** Revision notes stay editable after the mock; the answer doesn't. */
  async saveNote(attemptId: string, clientId: string, questionId: string, notes: string): Promise<boolean> {
    const rows = await this.sql`
      INSERT INTO mock_responses (attempt_id, question_id, notes)
      SELECT a.id, i.question_id, ${notes}
      FROM mock_attempts a JOIN mock_items i ON i.mock_id = a.mock_id AND i.question_id = ${questionId}
      WHERE a.id = ${attemptId} AND a.client_id = ${clientId}
      ON CONFLICT (attempt_id, question_id) DO UPDATE SET notes = EXCLUDED.notes
      RETURNING 1
    `;
    return rows.length > 0;
  }

  private static json(responses: MockResponse[]): string {
    return JSON.stringify(
      responses.map((r) => ({ question_id: r.questionId, selected: r.selected, flagged: r.flagged, notes: r.notes, seconds: r.seconds, confidence: r.confidence })),
    );
  }

  private static toExam(r: ExamRow): MockExam {
    return {
      id: r.id,
      title: r.title,
      mockType: r.mock_type,
      source: r.source,
      durationMinutes: r.duration_minutes,
      level: r.level,
      published: r.published,
      audience: r.audience,
      courses: r.courses,
      questionCount: r.question_count,
      attempted: r.attempted,
      createdAt: r.created_at,
    };
  }

  private static toBank(r: BankRow): PoolQuestion {
    return { ...MockRepository.toActive(r), correct: r.correct, explanation: r.explanation, why: [r.why_a, r.why_b, r.why_c], chapter: r.chapter, usage: r.usage, level: r.level, retired: r.retired, locked: r.locked, usedIn: r.used_in };
  }

  private static toActive(r: ActiveRow): ActiveQuestion {
    return { id: r.id, number: r.number, topic: r.topic, vignette: r.vignette, question: r.question, options: [r.option_a, r.option_b, r.option_c] };
  }

  private static toAttempt(r: AttemptRow): MockAttempt {
    return {
      id: r.id,
      clientId: r.client_id,
      mockId: r.mock_id,
      startedAt: r.started_at,
      endsAt: r.ends_at,
      submittedAt: r.submitted_at,
      score: r.score,
      total: r.total,
      status: r.status,
      session: r.session,
      breakUntil: r.break_until,
      pausedAt: r.paused_at,
      questionIds: r.question_ids,
      screen: r.screen ?? null,
    };
  }
}
