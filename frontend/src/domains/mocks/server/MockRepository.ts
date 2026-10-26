import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type {
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

/** Postgres-backed mock exams (migration 055_mock_exams). Every student read checks the attempt is theirs. */
export class MockRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): MockRepository | null {
    const sql = Database.sql();
    return sql ? new MockRepository(sql) : null;
  }

  // --- Admin ---

  async all(): Promise<MockExam[]> {
    const rows = (await this.sql`
      SELECT e.*, (SELECT count(*)::int FROM mock_questions q WHERE q.mock_id = e.id) AS question_count,
             EXISTS (SELECT 1 FROM mock_attempts a WHERE a.mock_id = e.id) AS attempted
      FROM mock_exams e ORDER BY e.created_at DESC
    `) as ExamRow[];
    return rows.map(MockRepository.toExam);
  }

  async byId(id: string): Promise<MockExam | null> {
    const [row] = (await this.sql`
      SELECT e.*, (SELECT count(*)::int FROM mock_questions q WHERE q.mock_id = e.id) AS question_count,
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
    await this.sql`UPDATE mock_exams SET published = ${on} WHERE id = ${id}`;
  }

  /** False when students have sat it (the attempts keep it), unless `withAttempts`: their attempts and results go too. */
  async remove(id: string, withAttempts = false): Promise<boolean> {
    const [, rows] = await this.sql.transaction([
      withAttempts ? this.sql`DELETE FROM mock_attempts WHERE mock_id = ${id}` : this.sql`SELECT 1`,
      this.sql`DELETE FROM mock_exams WHERE id = ${id} AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${id}) RETURNING id`,
    ]);
    return (rows as unknown[]).length > 0;
  }

  /**
   * Swaps in a new sheet; refused (false) once anyone has started the mock, so results never shift under a
   * student, unless `clearAttempts`: the attempts and their results are deleted with the old questions.
   */
  async replaceQuestions(mockId: string, questions: MockQuestionInput[], clearAttempts = false): Promise<boolean> {
    const rows = JSON.stringify(
      questions.map((q) => ({
        number: q.number,
        topic: q.topic,
        vignette: q.vignette,
        question: q.question,
        option_a: q.options[0],
        option_b: q.options[1],
        option_c: q.options[2],
        correct: q.correct,
        explanation: q.explanation,
      })),
    );
    const [, , inserted] = await this.sql.transaction([
      clearAttempts ? this.sql`DELETE FROM mock_attempts WHERE mock_id = ${mockId}` : this.sql`SELECT 1`,
      this.sql`DELETE FROM mock_questions WHERE mock_id = ${mockId} AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId})`,
      this.sql`
        INSERT INTO mock_questions (mock_id, number, topic, vignette, question, option_a, option_b, option_c, correct, explanation)
        SELECT ${mockId}::uuid, r.number, r.topic, r.vignette, r.question, r.option_a, r.option_b, r.option_c, r.correct, r.explanation
        FROM jsonb_to_recordset(${rows}::jsonb) AS r(number int, topic text, vignette text, question text, option_a text,
                                                     option_b text, option_c text, correct text, explanation text)
        WHERE NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId})
        RETURNING id
      `,
    ]);
    return (inserted as unknown[]).length > 0;
  }

  /** The clients a mock is granted to (audience "clients"). */
  async accessClients(mockId: string): Promise<string[]> {
    const rows = (await this.sql`SELECT client_id FROM mock_access WHERE mock_id = ${mockId}`) as { client_id: string }[];
    return rows.map((r) => r.client_id);
  }

  /** Clients who can sign in to the portal (they have a course), for the access form. */
  async students(): Promise<MockStudent[]> {
    return (await this.sql`
      SELECT id, name, email, courses FROM clients WHERE cardinality(courses) > 0 ORDER BY lower(name) LIMIT 1000
    `) as MockStudent[];
  }

  async setAccess(mockId: string, access: MockAccess): Promise<void> {
    await this.sql.transaction([
      this.sql`UPDATE mock_exams SET audience = ${access.audience}, courses = ${access.courses}::text[] WHERE id = ${mockId}`,
      this.sql`DELETE FROM mock_access WHERE mock_id = ${mockId}`,
      this.sql`
        INSERT INTO mock_access (mock_id, client_id)
        SELECT ${mockId}::uuid, c.id FROM clients c WHERE c.id = ANY(${access.clients}::uuid[])
      `,
    ]);
  }

  /** Topic names already used, so a new question can reuse the spelling (Progress and the bank group by it). */
  async topicNames(): Promise<string[]> {
    const rows = (await this.sql`SELECT DISTINCT ON (lower(trim(topic))) trim(topic) AS topic FROM mock_questions ORDER BY lower(trim(topic))`) as { topic: string }[];
    return rows.map((r) => r.topic);
  }

  /**
   * Every distinct question uploaded (a question copied into a pool mock counts once), optionally only
   * from some mocks, with the mock it came from: the question bank. Topics are matched ignoring case
   * and spaces at the ends, as Progress matches them.
   */
  async pool(from: string[] = []): Promise<PoolQuestion[]> {
    const rows = (await this.sql`
      SELECT DISTINCT ON (lower(trim(q.topic)), q.vignette, q.question, q.option_a, q.option_b, q.option_c) q.*, e.title AS mock_title
      FROM mock_questions q JOIN mock_exams e ON e.id = q.mock_id
      WHERE cardinality(${from}::uuid[]) = 0 OR q.mock_id = ANY(${from}::uuid[])
      ORDER BY lower(trim(q.topic)), q.vignette, q.question, q.option_a, q.option_b, q.option_c, e.created_at
    `) as (QuestionRow & { mock_id: string; mock_title: string })[];
    return rows
      .map((r) => ({ ...MockRepository.toActive(r), correct: r.correct, explanation: r.explanation, mockId: r.mock_id, mockTitle: r.mock_title }))
      .sort((a, b) => a.topic.toLowerCase().localeCompare(b.topic.toLowerCase()) || a.mockTitle.localeCompare(b.mockTitle) || a.number - b.number);
  }

  /**
   * A new draft mock copied from the pool: every ticked question, and per topic random ones until it
   * has that topic's number (ticked ones count towards it). Topics in the order given; a vignette set
   * stays together. Copies, so the source mocks and their results never change. Null when nothing matches.
   */
  async buildFromPool(m: MockExamInput, pick: PoolPick): Promise<{ id: string; count: number } | null> {
    const quotas = JSON.stringify(pick.quotas);
    const [row] = (await this.sql`
      WITH pool AS (
        SELECT DISTINCT ON (lower(trim(topic)), vignette, question, option_a, option_b, option_c) *
        FROM mock_questions
        WHERE cardinality(${pick.from}::uuid[]) = 0 OR mock_id = ANY(${pick.from}::uuid[]) OR id = ANY(${pick.ids}::uuid[])
        ORDER BY lower(trim(topic)), vignette, question, option_a, option_b, option_c, id = ANY(${pick.ids}::uuid[]) DESC, random()
      ), want AS (
        SELECT lower(trim(w.e->>'topic')) AS key, (w.e->>'count')::int AS count, w.ord FROM jsonb_array_elements(${quotas}::jsonb) WITH ORDINALITY AS w(e, ord)
      ), ranked AS (
        SELECT pool.*, lower(trim(pool.topic)) AS key,
          row_number() OVER (PARTITION BY lower(trim(pool.topic)) ORDER BY pool.id = ANY(${pick.ids}::uuid[]) DESC, random()) AS r
        FROM pool
      ), picked AS (
        SELECT ranked.*, row_number() OVER (ORDER BY want.ord NULLS LAST, ranked.key, ranked.vignette, CASE WHEN ranked.vignette = '' THEN random() END, ranked.mock_id, ranked.number) AS n
        FROM ranked LEFT JOIN want USING (key)
        WHERE ranked.id = ANY(${pick.ids}::uuid[]) OR ranked.r <= want.count
      ), exam AS (
        INSERT INTO mock_exams (title, mock_type, source, duration_minutes)
        SELECT ${m.title}, ${m.mockType}, ${m.source}, ${m.durationMinutes} WHERE EXISTS (SELECT 1 FROM picked)
        RETURNING id
      ), copied AS (
        INSERT INTO mock_questions (mock_id, number, topic, vignette, question, option_a, option_b, option_c, correct, explanation)
        SELECT exam.id, p.n, p.topic, p.vignette, p.question, p.option_a, p.option_b, p.option_c, p.correct, p.explanation
        FROM exam CROSS JOIN picked p WHERE p.n <= ${MockContract.MAX_QUESTIONS}
        RETURNING 1
      )
      SELECT exam.id, (SELECT count(*)::int FROM copied) AS count FROM exam
    `) as { id: string; count: number }[];
    return row ?? null;
  }

  /**
   * Adds (no `questionId`) or edits one question. "fixed" once anyone has started the mock, as a new
   * sheet is; "taken" when another question has that number.
   */
  async saveQuestion(mockId: string, questionId: string | null, q: MockQuestionInput): Promise<"saved" | "fixed" | "taken"> {
    try {
      const rows = questionId
        ? await this.sql`
            UPDATE mock_questions SET number = ${q.number}, topic = ${q.topic}, vignette = ${q.vignette}, question = ${q.question},
              option_a = ${q.options[0]}, option_b = ${q.options[1]}, option_c = ${q.options[2]}, correct = ${q.correct}, explanation = ${q.explanation}
            WHERE id = ${questionId} AND mock_id = ${mockId} AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId})
            RETURNING id
          `
        : await this.sql`
            INSERT INTO mock_questions (mock_id, number, topic, vignette, question, option_a, option_b, option_c, correct, explanation)
            SELECT ${mockId}::uuid, ${q.number}, ${q.topic}, ${q.vignette}, ${q.question}, ${q.options[0]}, ${q.options[1]}, ${q.options[2]}, ${q.correct}, ${q.explanation}
            WHERE NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId})
            RETURNING id
          `;
      return rows.length > 0 ? "saved" : "fixed";
    } catch (error) {
      if (Database.isUniqueViolation(error)) return "taken";
      throw error;
    }
  }

  /** False once anyone has started the mock. The gap in numbers is fine: an attempt numbers its questions 1 to n. */
  async deleteQuestion(mockId: string, questionId: string): Promise<boolean> {
    const rows = await this.sql`
      DELETE FROM mock_questions WHERE id = ${questionId} AND mock_id = ${mockId} AND NOT EXISTS (SELECT 1 FROM mock_attempts WHERE mock_id = ${mockId}) RETURNING id
    `;
    return rows.length > 0;
  }

  /** With answers and explanations: for grading and results only, never an open attempt's page. */
  async questions(mockId: string): Promise<MockQuestion[]> {
    const rows = (await this.sql`SELECT * FROM mock_questions WHERE mock_id = ${mockId} ORDER BY number`) as QuestionRow[];
    return rows.map((r) => ({ ...MockRepository.toActive(r), correct: r.correct, explanation: r.explanation }));
  }

  // --- Students ---

  /** What the student's lobby lists: published mocks with questions that are open to them (same rule as `start`). */
  async published(clientId: string): Promise<MockExam[]> {
    const rows = (await this.sql`
      SELECT e.*, n.question_count, false AS attempted
      FROM mock_exams e
      JOIN clients c ON c.id = ${clientId}
      CROSS JOIN LATERAL (SELECT count(*)::int AS question_count FROM mock_questions q WHERE q.mock_id = e.id) n
      WHERE e.published AND n.question_count > 0
        AND (e.audience = 'all'
          OR (e.audience = 'course' AND e.courses && c.courses)
          OR (e.audience = 'clients' AND EXISTS (SELECT 1 FROM mock_access x WHERE x.mock_id = e.id AND x.client_id = c.id)))
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

  /** Every closed attempt's marks by topic, oldest first: what the portal's Progress tab is built from. */
  async topicMarks(clientId: string): Promise<TopicMark[]> {
    const rows = (await this.sql`
      SELECT a.id, e.title, a.submitted_at, q.topic, count(*)::int AS total, count(*) FILTER (WHERE r.selected = q.correct)::int AS correct
      FROM mock_attempts a
      JOIN mock_exams e ON e.id = a.mock_id
      JOIN mock_questions q ON q.mock_id = a.mock_id
      LEFT JOIN mock_responses r ON r.attempt_id = a.id AND r.question_id = q.id
      WHERE a.client_id = ${clientId} AND a.status = 'completed'
      GROUP BY a.id, e.title, a.submitted_at, q.topic
      ORDER BY a.submitted_at, a.id, min(q.number)
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
      JOIN clients cl ON cl.id = ${clientId}
      CROSS JOIN LATERAL (SELECT count(*)::int AS n FROM mock_questions WHERE mock_id = e.id) c
      WHERE e.id = ${mockId} AND e.published AND c.n > 0
        AND (e.audience = 'all'
          OR (e.audience = 'course' AND e.courses && cl.courses)
          OR (e.audience = 'clients' AND EXISTS (SELECT 1 FROM mock_access x WHERE x.mock_id = e.id AND x.client_id = cl.id)))
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
      SELECT id, number, topic, vignette, question, option_a, option_b, option_c FROM mock_questions WHERE mock_id = ${mockId} ORDER BY number
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
        JOIN mock_questions q ON q.id = r.question_id AND q.mock_id = live.mock_id
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
        JOIN mock_questions q ON q.id = r.question_id AND q.mock_id = done.mock_id
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
        JOIN mock_questions q ON q.id = r.question_id AND q.mock_id = moved.mock_id
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
      SELECT a.id, q.id, ${notes}
      FROM mock_attempts a JOIN mock_questions q ON q.mock_id = a.mock_id AND q.id = ${questionId}
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
