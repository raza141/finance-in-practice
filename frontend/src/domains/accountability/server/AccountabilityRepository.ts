import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { DayTotal, Difficulty, GoalInput, GoalLevel, GoalOption, LogEntry, Mark, ScheduleRow, StudyFacts, StudyGoal, StudyKind } from "../types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CHECK_VIOLATION = "23514";

type ScheduleRecord = ScheduleRow & { clientId: string };
type AnswerDay = { clientId: string; date: string; level: number; questions: number; minutes: number };
type LogDay = { clientId: string; date: string; course: string; minutes: number; sameDay: number };
type MarkRow = Mark & { clientId: string };
type WeakRow = { clientId: string; name: string; correct: number; total: number };
type ScoreRow = { clientId: string; percent: number };

/**
 * Study goals, schedules and manual log (077), and the reads the accountability loop derives from. It only ever
 * reads the mock tables. Every write is scoped to the client id from the session.
 *
 * An answer's day is its first change in mock_response_history (068), else the attempt's submit time, in the
 * zone the student had then. Right and wrong are read from finished attempts only: a live score that moved
 * with each answer would give the answers away during an exam.
 */
export class AccountabilityRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): AccountabilityRepository | null {
    const sql = Database.sql();
    return sql ? new AccountabilityRepository(sql) : null;
  }

  /** The student's open CFA courses with a question bank, and their batch's date for each. */
  async options(clientId: string): Promise<GoalOption[]> {
    if (!UUID.test(clientId)) return [];
    return (await this.sql`
      SELECT x.course, t.level, to_char(COALESCE(cb.exam_date, b.exam_date), 'YYYY-MM-DD') AS "examOn"
      FROM unnest(client_live_courses(${clientId}::uuid)) AS x(course)
      JOIN LATERAL (
        SELECT CASE c.testimonial_ticker WHEN 'CFA1' THEN 1 WHEN 'CFA2' THEN 2 END AS level
        FROM courses c WHERE c.title = x.course ORDER BY c.is_active DESC LIMIT 1
      ) t ON t.level IS NOT NULL
      LEFT JOIN client_batches cb ON cb.client_id = ${clientId}::uuid AND cb.course = x.course
      LEFT JOIN batches b ON b.course = cb.course AND b.label = cb.label
      ORDER BY COALESCE(cb.exam_date, b.exam_date) NULLS LAST, t.level
    `) as { course: string; level: GoalLevel; examOn: string | null }[];
  }

  /**
   * One student's facts, or everyone's with a goal (`clientId` null: the owner's page and its figures). Each
   * student's current goal: an open course first, then the one saved last. One HTTP round trip.
   */
  async facts(clientId: string | null): Promise<StudyFacts[]> {
    if (clientId !== null && !UUID.test(clientId)) return [];
    const sql = this.sql;
    const results = await sql.transaction(
      [
        sql`
          SELECT DISTINCT ON (g.client_id) g.client_id AS "clientId", c.name, c.email, c.hide_exam_countdown AS "hideCountdown",
            l.live, g.course, g.level,
            to_char(COALESCE(cb.exam_date, b.exam_date, g.exam_on), 'YYYY-MM-DD') AS "examOn",
            to_char(g.started_on, 'YYYY-MM-DD') AS "startedOn",
            to_char(g.created_at AT TIME ZONE COALESCE(
              (SELECT s.time_zone FROM study_schedules s WHERE s.client_id = g.client_id ORDER BY s.effective_from LIMIT 1), 'Asia/Dubai'
            ), 'YYYY-MM-DD') AS "createdOn",
            g.target_hours AS "targetHours", g.hours_per_day::float8 AS "hoursPerDay", g.prior_minutes AS "priorMinutes"
          FROM study_goals g
          JOIN clients c ON c.id = g.client_id
          CROSS JOIN LATERAL (SELECT g.course = ANY(client_live_courses(g.client_id)) AS live) l
          LEFT JOIN client_batches cb ON cb.client_id = g.client_id AND cb.course = g.course
          LEFT JOIN batches b ON b.course = cb.course AND b.label = cb.label
          WHERE ${clientId}::uuid IS NULL OR g.client_id = ${clientId}::uuid
          ORDER BY g.client_id, l.live DESC, g.updated_at DESC
        `,
        sql`
          SELECT client_id AS "clientId", to_char(effective_from AT TIME ZONE time_zone, 'YYYY-MM-DD') AS "from", time_zone AS "timeZone", study_days AS days
          FROM study_schedules
          WHERE ${clientId}::uuid IS NULL OR client_id = ${clientId}::uuid
          ORDER BY client_id, effective_from
        `,
        // ponytail: reads each student's whole answer history; a daily rollup table if the page gets slow.
        sql`
          WITH answers AS (
            SELECT a.client_id, r.question_id, r.seconds, COALESCE(h.at, a.submitted_at) AS at, (h.at IS NOT NULL OR r.selected IS NOT NULL) AS answered
            FROM mock_attempts a
            JOIN mock_responses r ON r.attempt_id = a.id
            LEFT JOIN LATERAL (
              SELECT min(changed_at) AS at FROM mock_response_history WHERE attempt_id = a.id AND question_id = r.question_id
            ) h ON true
            WHERE a.client_id IN (SELECT client_id FROM study_goals)
              AND (${clientId}::uuid IS NULL OR a.client_id = ${clientId}::uuid)
              AND COALESCE(h.at, a.submitted_at) IS NOT NULL
          )
          SELECT n.client_id AS "clientId",
            to_char(n.at AT TIME ZONE COALESCE(z.time_zone, 'Asia/Dubai'), 'YYYY-MM-DD') AS date,
            q.level,
            count(DISTINCT q.content_key) FILTER (WHERE n.answered)::int AS questions,
            (sum(LEAST(n.seconds, 600)) / 60.0)::float8 AS minutes
          FROM answers n
          JOIN mock_questions q ON q.id = n.question_id
          LEFT JOIN LATERAL (
            SELECT s.time_zone FROM study_schedules s WHERE s.client_id = n.client_id
            ORDER BY s.effective_from <= n.at DESC, CASE WHEN s.effective_from <= n.at THEN s.effective_from END DESC, s.effective_from
            LIMIT 1
          ) z ON true
          GROUP BY 1, 2, 3
        `,
        sql`
          SELECT l.client_id AS "clientId", to_char(l.local_date, 'YYYY-MM-DD') AS date, l.course, sum(l.minutes)::int AS minutes,
            COALESCE(sum(l.minutes) FILTER (WHERE (l.created_at AT TIME ZONE COALESCE(z.time_zone, 'Asia/Dubai'))::date = l.local_date), 0)::int AS "sameDay"
          FROM study_log l
          LEFT JOIN LATERAL (
            SELECT s.time_zone FROM study_schedules s WHERE s.client_id = l.client_id
            ORDER BY s.effective_from <= l.created_at DESC, CASE WHEN s.effective_from <= l.created_at THEN s.effective_from END DESC, s.effective_from
            LIMIT 1
          ) z ON true
          WHERE ${clientId}::uuid IS NULL OR l.client_id = ${clientId}::uuid
          GROUP BY 1, 2, 3
        `,
        // Each question once, at its first answer in the window, so repeating it can't lift accuracy.
        sql`
          WITH goal AS (
            SELECT DISTINCT ON (g.client_id) g.client_id, g.level,
              COALESCE((SELECT s.time_zone FROM study_schedules s WHERE s.client_id = g.client_id ORDER BY s.effective_from DESC LIMIT 1), 'Asia/Dubai') AS zone
            FROM study_goals g
            WHERE ${clientId}::uuid IS NULL OR g.client_id = ${clientId}::uuid
            ORDER BY g.client_id, g.course = ANY(client_live_courses(g.client_id)) DESC, g.updated_at DESC
          ), first AS (
            SELECT DISTINCT ON (a.client_id, q.content_key) a.client_id, q.difficulty, r.selected = q.correct AS correct
            FROM goal
            JOIN mock_attempts a ON a.client_id = goal.client_id AND a.status = 'completed'
            JOIN mock_responses r ON r.attempt_id = a.id AND r.selected IS NOT NULL
            JOIN mock_questions q ON q.id = r.question_id AND q.level = goal.level
            WHERE (a.submitted_at AT TIME ZONE goal.zone)::date >= (now() AT TIME ZONE goal.zone)::date - 13
            ORDER BY a.client_id, q.content_key, a.submitted_at
          )
          SELECT client_id AS "clientId", difficulty, count(*)::int AS total, count(*) FILTER (WHERE correct)::int AS correct
          FROM first GROUP BY 1, 2
        `,
        sql`
          WITH goal AS (
            SELECT DISTINCT ON (g.client_id) g.client_id, g.level
            FROM study_goals g
            WHERE ${clientId}::uuid IS NULL OR g.client_id = ${clientId}::uuid
            ORDER BY g.client_id, g.course = ANY(client_live_courses(g.client_id)) DESC, g.updated_at DESC
          ), bank AS (
            SELECT DISTINCT level, lower(trim(topic)) AS topic, lower(trim(chapter)) AS chapter
            FROM mock_questions WHERE NOT retired AND trim(chapter) <> ''
          ), touched AS (
            SELECT DISTINCT a.client_id, q.level, lower(trim(q.topic)) AS topic, lower(trim(q.chapter)) AS chapter
            FROM goal
            JOIN mock_attempts a ON a.client_id = goal.client_id
            JOIN mock_responses r ON r.attempt_id = a.id AND r.selected IS NOT NULL
            JOIN mock_questions q ON q.id = r.question_id AND q.level = goal.level
          )
          SELECT goal.client_id AS "clientId",
            (SELECT count(*) FROM bank WHERE bank.level = goal.level)::int AS total,
            (SELECT count(*) FROM bank JOIN touched t USING (level, topic, chapter) WHERE t.client_id = goal.client_id AND bank.level = goal.level)::int AS touched
          FROM goal
        `,
        sql`
          WITH goal AS (
            SELECT DISTINCT ON (g.client_id) g.client_id, g.level
            FROM study_goals g
            WHERE ${clientId}::uuid IS NULL OR g.client_id = ${clientId}::uuid
            ORDER BY g.client_id, g.course = ANY(client_live_courses(g.client_id)) DESC, g.updated_at DESC
          ), topics AS (
            SELECT a.client_id, min(COALESCE(NULLIF(trim(q.chapter), ''), trim(q.topic))) AS name,
              count(*)::int AS total, count(*) FILTER (WHERE r.selected = q.correct)::int AS correct
            FROM goal
            JOIN mock_attempts a ON a.client_id = goal.client_id AND a.status = 'completed'
            JOIN mock_responses r ON r.attempt_id = a.id AND r.selected IS NOT NULL
            JOIN mock_questions q ON q.id = r.question_id AND q.level = goal.level
            GROUP BY a.client_id, lower(trim(q.topic)), lower(trim(q.chapter))
            HAVING count(*) >= 3
          ), ranked AS (
            SELECT *, row_number() OVER (PARTITION BY client_id ORDER BY correct::float8 / total, total DESC) AS n FROM topics
          )
          SELECT client_id AS "clientId", name, correct, total FROM ranked WHERE n <= 3 ORDER BY client_id, n
        `,
        // The same attempts as the Progress tab: no drills, end-of-chapter sets or mistakes retakes.
        sql`
          WITH ranked AS (
            SELECT a.client_id, a.submitted_at, round(100.0 * a.score / a.total)::int AS percent,
              row_number() OVER (PARTITION BY a.client_id ORDER BY a.submitted_at DESC) AS n
            FROM mock_attempts a JOIN mock_exams e ON e.id = a.mock_id
            WHERE a.client_id IN (SELECT client_id FROM study_goals)
              AND (${clientId}::uuid IS NULL OR a.client_id = ${clientId}::uuid)
              AND a.status = 'completed' AND a.score IS NOT NULL AND a.total > 0
              AND e.mock_type <> 'chapter' AND a.question_ids IS NULL AND e.owner_client IS NULL
          )
          SELECT client_id AS "clientId", percent FROM ranked WHERE n <= 5 ORDER BY client_id, submitted_at
        `,
      ],
      { readOnly: true },
    );
    const [goals, schedules, answers, log, marks, chapters, weakest, scores] = results as unknown as [
      StudyGoal[],
      ScheduleRecord[],
      AnswerDay[],
      LogDay[],
      MarkRow[],
      { clientId: string; touched: number; total: number }[],
      WeakRow[],
      ScoreRow[],
    ];
    const of = <T extends { clientId: string }>(rows: readonly T[]) => Map.groupBy(rows, (row) => row.clientId);
    const [scheduleOf, answersOf, logOf, marksOf, chaptersOf, weakestOf, scoresOf] = [of(schedules), of(answers), of(log), of(marks), of(chapters), of(weakest), of(scores)];

    return goals.map((goal) => {
      const answered = answersOf.get(goal.clientId) ?? [];
      const logged = logOf.get(goal.clientId) ?? [];
      const days = new Map<string, DayTotal>();
      const add = (date: string, questions: number, minutes: number) => {
        const day = days.get(date) ?? { date, questions: 0, minutes: 0 };
        day.questions += questions;
        day.minutes += minutes;
        days.set(date, day);
      };
      for (const a of answered) add(a.date, a.questions, a.minutes);
      for (const l of logged) add(l.date, 0, l.sameDay);
      return {
        goal,
        schedule: (scheduleOf.get(goal.clientId) ?? []).map((s) => ({ from: s.from, timeZone: s.timeZone, days: s.days })),
        days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
        goalMinutes: [...answered.filter((a) => a.level === goal.level), ...logged.filter((l) => l.course === goal.course)].map(({ date, minutes }) => ({ date, minutes })),
        marks: (marksOf.get(goal.clientId) ?? []).map((m) => ({ difficulty: m.difficulty as Difficulty, correct: m.correct, total: m.total })),
        chapters: { touched: chaptersOf.get(goal.clientId)?.[0].touched ?? 0, total: chaptersOf.get(goal.clientId)?.[0].total ?? 0 },
        weakest: (weakestOf.get(goal.clientId) ?? []).map(({ name, correct, total }) => ({ name, correct, total })),
        mockScores: (scoresOf.get(goal.clientId) ?? []).map((s) => s.percent),
      };
    });
  }

  /** Their entries they can still remove: the last two days'. */
  async recentLog(clientId: string): Promise<LogEntry[]> {
    if (!UUID.test(clientId)) return [];
    return (await this.sql`
      SELECT id, to_char(local_date, 'YYYY-MM-DD') AS date, minutes, kind FROM study_log
      WHERE client_id = ${clientId} AND created_at > now() - interval '2 days'
      ORDER BY created_at DESC
    `) as LogEntry[];
  }

  /**
   * Saves the goal and, when the days or zone changed, a new schedule row (old days keep theirs). False: the
   * course isn't open to them, or Postgres doesn't know the zone (AT TIME ZONE would throw on every read).
   */
  async saveGoal(clientId: string, level: GoalLevel, g: GoalInput): Promise<boolean> {
    if (!UUID.test(clientId)) return false;
    const sql = this.sql;
    const [saved] = await sql.transaction([
      sql`
        INSERT INTO study_goals (client_id, course, level, exam_on, started_on, target_hours, hours_per_day, prior_minutes)
        SELECT ${clientId}::uuid, ${g.course}, ${level}::smallint, ${g.examOn}::date, ${g.startedOn}::date, ${g.targetHours}::smallint, ${g.hoursPerDay}::numeric, ${g.priorMinutes}::integer
        WHERE ${g.course} = ANY(client_live_courses(${clientId}::uuid)) AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${g.timeZone})
        ON CONFLICT (client_id, course) DO UPDATE SET level = EXCLUDED.level, exam_on = EXCLUDED.exam_on, started_on = EXCLUDED.started_on,
          target_hours = EXCLUDED.target_hours, hours_per_day = EXCLUDED.hours_per_day, prior_minutes = EXCLUDED.prior_minutes, updated_at = now()
        RETURNING 1
      `,
      sql`
        INSERT INTO study_schedules (client_id, time_zone, study_days)
        SELECT ${clientId}::uuid, ${g.timeZone}, ${g.studyDays}::smallint[]
        WHERE ${g.course} = ANY(client_live_courses(${clientId}::uuid)) AND EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = ${g.timeZone})
          AND (${g.timeZone}, ${g.studyDays}::smallint[]) IS DISTINCT FROM (
            (SELECT time_zone FROM study_schedules WHERE client_id = ${clientId}::uuid ORDER BY effective_from DESC LIMIT 1),
            (SELECT study_days FROM study_schedules WHERE client_id = ${clientId}::uuid ORDER BY effective_from DESC LIMIT 1)
          )
      `,
    ]);
    return (saved as unknown[]).length > 0;
  }

  async addLog(clientId: string, course: string, entry: { date: string; minutes: number; kind: StudyKind }): Promise<"saved" | "over_cap" | "refused"> {
    if (!UUID.test(clientId)) return "refused";
    try {
      const rows = await this.sql`
        INSERT INTO study_log (client_id, course, local_date, minutes, kind)
        SELECT ${clientId}::uuid, ${course}, ${entry.date}::date, ${entry.minutes}::smallint, ${entry.kind}
        WHERE ${course} = ANY(client_live_courses(${clientId}::uuid))
        RETURNING 1
      `;
      return rows.length ? "saved" : "refused";
    } catch (error) {
      if ((error as { code?: unknown })?.code === CHECK_VIOLATION) return "over_cap";
      throw error;
    }
  }

  async removeLog(clientId: string, id: string): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(id)) return false;
    const rows = await this.sql`DELETE FROM study_log WHERE id = ${id} AND client_id = ${clientId} AND created_at > now() - interval '2 days' RETURNING 1`;
    return rows.length > 0;
  }
}
