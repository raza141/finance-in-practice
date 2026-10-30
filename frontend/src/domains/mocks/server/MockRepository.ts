import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type {
  AccessGrant,
  AccessGrantInput,
  ActiveQuestion,
  AttemptStatus,
  AttemptSummary,
  MockAttempt,
  MockAccess,
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
import { MockGrader } from "../services/MockGrader";

interface ExamRow {
  id: string;
  title: string;
  mock_type: MockType;
  source: string;
  duration_minutes: number;
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

type QuestionRow = ActiveRow & { correct: OptionLetter; explanation: string };

type BankRow = QuestionRow & { chapter: string; usage: QuestionUsage; retired: boolean; locked: boolean; used_in: string[] };

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
      FROM mock_exams e ORDER BY e.created_at DESC
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
      INSERT INTO mock_exams (title, mock_type, source, duration_minutes)
      VALUES (${m.title}, ${m.mockType}, ${m.source}, ${m.durationMinutes})
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /** A new duration applies to attempts started from now on (open ones keep their end time). */
  async update(id: string, m: MockExamInput): Promise<void> {
    await this.sql`
      UPDATE mock_exams SET title = ${m.title}, mock_type = ${m.mockType}, source = ${m.source}, duration_minutes = ${m.durationMinutes}
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

  // --- The question bank ---

  /** Topic names already used, so a new question can reuse the spelling (Progress and the bank group by it). */
  async topicNames(): Promise<string[]> {
    const rows = (await this.sql`SELECT DISTINCT ON (lower(trim(topic))) trim(topic) AS topic FROM mock_questions ORDER BY lower(trim(topic))`) as { topic: string }[];
    return rows.map((r) => r.topic);
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
   */
  async pool(mock?: Pick<MockExam, "id" | "mockType">): Promise<PoolQuestion[]> {
    const usages = mock ? MockContract.usages(mock.mockType) : [];
    const rows = (await this.sql`
      SELECT DISTINCT ON (q.content_key) q.id, COALESCE(q.number, 0) AS number, q.topic, q.chapter, q.usage, q.retired, q.vignette, q.question,
        q.option_a, q.option_b, q.option_c, q.correct, q.explanation,
        EXISTS (
          SELECT 1 FROM mock_questions s JOIN mock_items i ON i.question_id = s.id JOIN mock_attempts a ON a.mock_id = i.mock_id WHERE s.content_key = q.content_key
        ) AS locked,
        ARRAY(
          SELECT DISTINCT e.title FROM mock_questions s JOIN mock_items i ON i.question_id = s.id JOIN mock_exams e ON e.id = i.mock_id WHERE s.content_key = q.content_key
        ) AS used_in
      FROM mock_questions q
      WHERE ${mock?.id ?? null}::uuid IS NULL OR (
        NOT q.retired AND q.usage = ANY(${usages}::text[])
        AND q.content_key NOT IN (SELECT s.content_key FROM mock_items i JOIN mock_questions s ON s.id = i.question_id WHERE i.mock_id = ${mock?.id ?? null}::uuid)
      )
      ORDER BY q.content_key, q.id
    `) as BankRow[];
    return rows
      .map(MockRepository.toBank)
      .sort((a, b) => a.topic.toLowerCase().localeCompare(b.topic.toLowerCase()) || a.chapter.toLowerCase().localeCompare(b.chapter.toLowerCase()) || a.question.localeCompare(b.question));
  }

  /** One bank question by the id of any of its copies: an assessment may hold a copy `pool` doesn't list. */
  async bankQuestion(id: string): Promise<PoolQuestion | null> {
    const [row] = (await this.sql`
      SELECT q.id, COALESCE(q.number, 0) AS number, q.topic, q.chapter, q.usage, q.retired, q.vignette, q.question, q.option_a, q.option_b, q.option_c, q.correct, q.explanation,
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
        topic: q.topic,
        chapter: q.chapter,
        usage: q.usage,
        vignette: q.vignette,
        question: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        correct: q.correct,
        explanation: q.explanation,
      })),
    );
    const inserted = await this.sql`
      WITH sheet AS (
        SELECT r.*, row_number() OVER () AS at, mock_question_key(r.topic, r.vignette, r.question, r.option_a, r.option_b, r.option_c, r.correct) AS key
        FROM jsonb_to_recordset(${rows}::jsonb) AS r(topic text, chapter text, usage text, vignette text, question text, option_a text,
                                                     option_b text, option_c text, correct text, explanation text)
      ), fresh AS (
        SELECT DISTINCT ON (key) * FROM sheet WHERE key NOT IN (SELECT content_key FROM mock_questions) ORDER BY key, at
      )
      INSERT INTO mock_questions (topic, chapter, usage, vignette, question, option_a, option_b, option_c, correct, explanation)
      SELECT topic, chapter, usage, vignette, question, option_a, option_b, option_c, correct, explanation FROM fresh
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
    const [{ taken }] = (await this.sql`
      SELECT EXISTS (
        SELECT 1 FROM mock_questions t WHERE t.content_key = mock_question_key(${q.topic}, ${q.vignette}, ${q.question}, ${o1}, ${o2}, ${o3}, ${q.correct})
          AND t.content_key IS DISTINCT FROM (SELECT content_key FROM mock_questions WHERE id = ${questionId}::uuid)
      ) AS taken
    `) as { taken: boolean }[];
    if (taken) return "duplicate";
    if (!questionId) {
      await this.sql`
        INSERT INTO mock_questions (topic, chapter, usage, vignette, question, option_a, option_b, option_c, correct, explanation)
        VALUES (${q.topic}, ${q.chapter}, ${q.usage}, ${q.vignette}, ${q.question}, ${o1}, ${o2}, ${o3}, ${q.correct}, ${q.explanation})
      `;
      return "saved";
    }
    const rows = await this.sql`
      UPDATE mock_questions t SET topic = ${q.topic}, chapter = ${q.chapter}, usage = ${q.usage}, vignette = ${q.vignette}, question = ${q.question},
        option_a = ${o1}, option_b = ${o2}, option_c = ${o3}, correct = ${q.correct}, explanation = ${q.explanation}
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
   * ones count towards it), after the questions it already has. Topics in the order given; a vignette
   * set stays together. Only what `pool(mock)` offers can go in, and nothing once students have started it.
   */
  async addFromBank(mock: Pick<MockExam, "id" | "mockType">, pick: PoolPick): Promise<number> {
    const quotas = JSON.stringify(pick.quotas);
    const [row] = (await this.sql`
      WITH open AS (
        SELECT COALESCE((SELECT max(number) FROM mock_items WHERE mock_id = ${mock.id}), 0) AS last
        WHERE NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mock.id})
      ), pool AS (
        SELECT DISTINCT ON (content_key) *
        FROM mock_questions
        WHERE NOT retired AND usage = ANY(${MockContract.usages(mock.mockType)}::text[])
          AND (${pick.chapter} = '' OR lower(trim(chapter)) = lower(${pick.chapter}) OR id = ANY(${pick.ids}::uuid[]))
          AND content_key NOT IN (SELECT s.content_key FROM mock_items i JOIN mock_questions s ON s.id = i.question_id WHERE i.mock_id = ${mock.id})
        ORDER BY content_key, id = ANY(${pick.ids}::uuid[]) DESC, random()
      ), want AS (
        SELECT lower(trim(w.e->>'topic')) AS key, (w.e->>'count')::int AS count, w.ord FROM jsonb_array_elements(${quotas}::jsonb) WITH ORDINALITY AS w(e, ord)
      ), ranked AS (
        SELECT pool.*, lower(trim(pool.topic)) AS key,
          row_number() OVER (PARTITION BY lower(trim(pool.topic)) ORDER BY pool.id = ANY(${pick.ids}::uuid[]) DESC, random()) AS r
        FROM pool
      ), picked AS (
        SELECT ranked.id, row_number() OVER (ORDER BY want.ord NULLS LAST, ranked.key, ranked.vignette, CASE WHEN ranked.vignette = '' THEN random() END, ranked.question) AS n
        FROM ranked LEFT JOIN want USING (key)
        WHERE ranked.id = ANY(${pick.ids}::uuid[]) OR ranked.r <= want.count
      ), added AS (
        INSERT INTO mock_items (mock_id, question_id, number)
        SELECT ${mock.id}::uuid, p.id, open.last + p.n FROM open CROSS JOIN picked p WHERE open.last + p.n <= ${MockContract.MAX_QUESTIONS}
        RETURNING 1
      )
      SELECT count(*)::int AS count FROM added
    `) as { count: number }[];
    return row.count;
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

  /** With answers and explanations: for grading and results only, never an open attempt's page. */
  async questions(mockId: string): Promise<MockQuestion[]> {
    const rows = (await this.sql`
      SELECT q.id, i.number, q.topic, q.vignette, q.question, q.option_a, q.option_b, q.option_c, q.correct, q.explanation
      FROM mock_items i JOIN mock_questions q ON q.id = i.question_id WHERE i.mock_id = ${mockId} ORDER BY i.number
    `) as QuestionRow[];
    return rows.map((r) => ({ ...MockRepository.toActive(r), correct: r.correct, explanation: r.explanation }));
  }

  // --- Students ---

  /** What the student's lobby lists: published mocks with questions that are open to them (same rule as `start`). */
  async published(clientId: string): Promise<MockExam[]> {
    const rows = (await this.sql`
      SELECT e.*, n.question_count, false AS attempted
      FROM mock_exams e
      CROSS JOIN LATERAL (SELECT count(*)::int AS question_count FROM mock_items i WHERE i.mock_id = e.id) n
      WHERE e.published AND n.question_count > 0 AND mock_open_to(e, ${clientId}::uuid)
      ORDER BY e.created_at DESC
    `) as ExamRow[];
    return rows.map(MockRepository.toExam);
  }

  async history(clientId: string): Promise<AttemptSummary[]> {
    const rows = (await this.sql`
      SELECT a.id, a.mock_id, e.title, a.started_at, a.submitted_at, a.score, a.total, a.status
      FROM mock_attempts a JOIN mock_exams e ON e.id = a.mock_id
      WHERE a.client_id = ${clientId} ORDER BY a.started_at DESC
    `) as (Pick<AttemptRow, "id" | "mock_id" | "started_at" | "submitted_at" | "score" | "total" | "status"> & { title: string })[];
    return rows.map((r) => ({
      id: r.id,
      mockId: r.mock_id,
      mockTitle: r.title,
      startedAt: r.started_at,
      submittedAt: r.submitted_at,
      score: r.score,
      total: r.total,
      status: r.status,
    }));
  }

  /** Every closed attempt's marks by topic, oldest first: what the portal's Progress tab is built from. End-of-chapter sets stay out, so practice doesn't skew it. */
  async topicMarks(clientId: string): Promise<TopicMark[]> {
    const rows = (await this.sql`
      SELECT a.id, e.title, a.submitted_at, q.topic, count(*)::int AS total, count(*) FILTER (WHERE r.selected = q.correct)::int AS correct
      FROM mock_attempts a
      JOIN mock_exams e ON e.id = a.mock_id
      JOIN mock_items i ON i.mock_id = a.mock_id
      JOIN mock_questions q ON q.id = i.question_id
      LEFT JOIN mock_responses r ON r.attempt_id = a.id AND r.question_id = q.id
      WHERE a.client_id = ${clientId} AND a.status = 'completed' AND e.mock_type <> 'chapter'
      GROUP BY a.id, e.title, a.submitted_at, q.topic
      ORDER BY a.submitted_at, a.id, min(i.number)
    `) as { id: string; title: string; submitted_at: Date; topic: string; total: number; correct: number }[];
    return rows.map((r) => ({ attemptId: r.id, title: r.title, at: r.submitted_at.toISOString(), topic: r.topic, correct: r.correct, total: r.total }));
  }

  /**
   * Starts the mock, or returns the student's open attempt at it. Null: not published, no questions,
   * or not open to this student (same rule as `published`). An attempt already open can be finished.
   */
  async start(clientId: string, mockId: string): Promise<string | null> {
    const [created] = (await this.sql`
      INSERT INTO mock_attempts (client_id, mock_id, ends_at, total)
      SELECT ${clientId}::uuid, e.id, now() + make_interval(mins => e.duration_minutes), c.n
      FROM mock_exams e
      CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM mock_items WHERE mock_id = e.id) c
      WHERE e.id = ${mockId} AND e.published AND c.n > 0 AND mock_open_to(e, ${clientId}::uuid)
      ON CONFLICT (client_id, mock_id) WHERE status = 'in_progress' DO NOTHING
      RETURNING id
    `) as { id: string }[];
    if (created) return created.id;
    const [open] = (await this.sql`
      SELECT id FROM mock_attempts WHERE client_id = ${clientId} AND mock_id = ${mockId} AND status = 'in_progress'
    `) as { id: string }[];
    return open?.id ?? null;
  }

  async attempt(attemptId: string, clientId: string): Promise<MockAttempt | null> {
    const [row] = (await this.sql`SELECT * FROM mock_attempts WHERE id = ${attemptId} AND client_id = ${clientId}`) as AttemptRow[];
    return row ? MockRepository.toAttempt(row) : null;
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
      SELECT question_id, selected, flagged, notes FROM mock_responses WHERE attempt_id = ${attemptId}
    `) as { question_id: string; selected: OptionLetter | null; flagged: boolean; notes: string }[];
    return rows.map((r) => ({ questionId: r.question_id, selected: r.selected, flagged: r.flagged, notes: r.notes }));
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
        INSERT INTO mock_responses (attempt_id, question_id, selected, flagged, notes)
        SELECT live.id, r.question_id, r.selected, r.flagged, r.notes
        FROM live CROSS JOIN jsonb_to_recordset(${MockRepository.json(responses)}::jsonb)
          AS r(question_id uuid, selected text, flagged boolean, notes text)
        JOIN mock_items i ON i.question_id = r.question_id AND i.mock_id = live.mock_id
        ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected = EXCLUDED.selected, flagged = EXCLUDED.flagged, notes = EXCLUDED.notes
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
        INSERT INTO mock_responses (attempt_id, question_id, selected, flagged, notes)
        SELECT done.id, r.question_id, r.selected, r.flagged, r.notes
        FROM done CROSS JOIN jsonb_to_recordset(${MockRepository.json(responses)}::jsonb)
          AS r(question_id uuid, selected text, flagged boolean, notes text)
        JOIN mock_items i ON i.question_id = r.question_id AND i.mock_id = done.mock_id
        ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected = EXCLUDED.selected, flagged = EXCLUDED.flagged, notes = EXCLUDED.notes
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
        INSERT INTO mock_responses (attempt_id, question_id, selected, flagged, notes)
        SELECT moved.id, r.question_id, r.selected, r.flagged, r.notes
        FROM moved CROSS JOIN jsonb_to_recordset(${MockRepository.json(responses)}::jsonb)
          AS r(question_id uuid, selected text, flagged boolean, notes text)
        JOIN mock_items i ON i.question_id = r.question_id AND i.mock_id = moved.mock_id
        ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected = EXCLUDED.selected, flagged = EXCLUDED.flagged, notes = EXCLUDED.notes
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM moved
    `) as { n: number }[];
    return row.n > 0;
  }

  /** Ends the break early: session 2's clock starts now. False when the break is already over. */
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

  /** Restarts the clock with the time that was left at the pause. */
  async resume(attemptId: string, clientId: string): Promise<boolean> {
    const rows = await this.sql`
      UPDATE mock_attempts SET ends_at = ends_at + (now() - paused_at), paused_at = NULL
      WHERE id = ${attemptId} AND client_id = ${clientId} AND status = 'in_progress' AND paused_at IS NOT NULL
      RETURNING id
    `;
    return rows.length > 0;
  }

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
    return JSON.stringify(responses.map((r) => ({ question_id: r.questionId, selected: r.selected, flagged: r.flagged, notes: r.notes })));
  }

  private static toExam(r: ExamRow): MockExam {
    return {
      id: r.id,
      title: r.title,
      mockType: r.mock_type,
      source: r.source,
      durationMinutes: r.duration_minutes,
      published: r.published,
      audience: r.audience,
      courses: r.courses,
      questionCount: r.question_count,
      attempted: r.attempted,
      createdAt: r.created_at,
    };
  }

  private static toBank(r: BankRow): PoolQuestion {
    return { ...MockRepository.toActive(r), correct: r.correct, explanation: r.explanation, chapter: r.chapter, usage: r.usage, retired: r.retired, locked: r.locked, usedIn: r.used_in };
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
    };
  }
}
