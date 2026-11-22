# Accountability loop: Phase 1 proposal

Status: **proposed 2026-11-22, not approved, not applied.** `077_accountability` is deliberately not in
`frontend/scripts/db/migrate.mts` until it is approved (a production build stops on any unapplied migration).

## Decisions needed

| # | Decision | Brief | Proposed |
|---|---|---|---|
| D1 | Schema | five new tables | 077 below: three tables; activity and streak derived |
| D2 | Rest days | every calendar day needs the bar or a freeze | an unplanned day neither counts nor breaks; studying on one still counts |
| D3 | Score | ratios capped at 1.2 | cap at 1.0; green also needs accuracy ≥ 55% and coverage ≥ 60%, else 79 at most |
| D4 | Tutor | `tutor` role + `tutor_link` | owner-only page in v1; role and links when there is a second tutor (auth change) |
| D5 | Reminders | daily email at the student's chosen time | after Phase 1: needs a scheduler finer than daily and a decision on `docs/on-hold.md` |
| D6 | Band colours | green / amber / red | emerald / gold / slate, always with the words (brand guide: no amber, red is for errors) |
| D7 | Preview | preview before production | an empty second database with made-up students (steps below), never a branch copy of production |

## What the brief asks for and what exists

| Brief | Exists | Change |
|---|---|---|
| `study_plan` | exam day in `client_batches` / `batches`; topic calendar in `study_plan_items` | `study_goals`. `exam_on` is used only when the student has no batch: a batch date always wins |
| `study_session` | `mock_responses.seconds`; `mock_response_history` (068) dates each answer | `study_log` for manual time only. Nothing is written in the exam's save path |
| `daily_activity` | derivable from the two above | no table |
| `streak_state` | derivable from daily totals | no table, no midnight job: one pure function |
| time zone | portal is fixed to Asia/Dubai | `study_schedules`, effective-dated, so a new zone or rest day can't rewrite old streak days |
| `tutor_link` | admin roles owner / editor / qa | D4 |
| reading id | `mock_questions.chapter` (free text, can be blank); Levels I and II only | coverage by chapter. No Level III or FRM coverage |
| manual hours | `session_log` is the owner's billing correction log | never reused: its minutes are billed |

## Rules to build to

**Activity**
- A question counts once a day (by `content_key`), on the student's local day of its first answer in that attempt.
- Minutes are the time on each question, at most 10 minutes a question (an idle tab keeps counting), on that same day.
- Answer history starts with 068 (early November 2026). Earlier finished attempts count on their submit day.
- Public question-bank and daily-question answers live in the browser only, so they don't count in v1.
- Tutoring sessions don't count in v1 (billing data). `prior_minutes` carries hours studied before joining.
- A manual entry is for today or yesterday, 8 hours a day at most. Only one made on the day itself can qualify a streak day.
- Deleting an attempt or a mock with its attempts removes that activity, so it can shorten a streak.

The daily query (tested for midnight in three zones, repeats, idle time and attempts older than 068):

```sql
WITH first AS (
  SELECT a.id AS attempt_id, r.question_id, r.seconds, COALESCE(h.at, a.submitted_at) AS at
  FROM mock_attempts a JOIN mock_responses r ON r.attempt_id = a.id
  LEFT JOIN LATERAL (
    SELECT min(changed_at) AS at FROM mock_response_history WHERE attempt_id = a.id AND question_id = r.question_id
  ) h ON true
  WHERE a.client_id = :'client' AND (h.at IS NOT NULL OR (r.selected IS NOT NULL AND a.submitted_at IS NOT NULL))
)
SELECT (f.at AT TIME ZONE :'tz')::date AS day, count(DISTINCT q.content_key) AS questions, sum(LEAST(f.seconds, 600)) / 60 AS minutes
FROM first f JOIN mock_questions q ON q.id = f.question_id GROUP BY 1 ORDER BY 1;
```

**Streak**
- The bar: 20 questions or 45 minutes. Today, unfinished, never breaks it.
- A missed planned day takes a freeze. Two per local calendar month, no rollover.
- None left: Earn Back runs for the next two local days (48 hours from the end of the missed day). 40 questions or
  90 minutes in total across them restores that day. The same work can't restore two days; those days still count
  for themselves.
- Perfect: no freeze and no Earn Back in the current streak.

**On-Track**
- Elapsed planned days exclude today. With none elapsed, or no expected readings, that ratio is 1.
- No answers in 14 days: accuracy is unknown, the factor is its 0.5 floor and the band can't be green.
- Accuracy is weighted by difficulty (easy 0.8, medium or untagged 1, hard 1.2) over questions answered, so easy
  questions alone score at most 80%, capped at 100%. This figure drives both the factor and the 55% gate in D3.
  The tutor's accuracy column shows plain accuracy.
- No study days left: required hours a day shows no figure, never a division by zero.

**Risk and check-in**
- Flag: three planned days missed in a row (frozen days count as missed here) or a score below 60.
- A check-in is drafted on demand. The tutor edits it and presses Send. Nothing sends by itself.

**Metrics**: all six in the brief derive from attempts, the log and goals, so no event table. Retention means
study activity, not page visits. Tutored vs solo means little until there are self-study students.

## 077_accountability

```ts
  {
    // Accountability loop F1–F4. Additive only: three new tables, no existing table, trigger or function touched.
    // Questions, minutes, streaks, freezes and Earn Back are derived, never stored: mock_response_history (068)
    // already dates each answer. study_log is the student's own study time; session_log stays billing's.
    id: "077_accountability",
    statements: [
      `CREATE TABLE study_goals (
        client_id     uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        course        text NOT NULL CHECK (char_length(course) BETWEEN 1 AND 200),
        level         smallint NOT NULL CHECK (level IN (1, 2, 3)),
        exam_on       date,
        started_on    date NOT NULL,
        target_hours  smallint NOT NULL DEFAULT 300 CHECK (target_hours BETWEEN 20 AND 2000),
        hours_per_day numeric(3,1) NOT NULL CHECK (hours_per_day BETWEEN 0.5 AND 16),
        prior_minutes integer NOT NULL DEFAULT 0 CHECK (prior_minutes BETWEEN 0 AND 120000),
        created_at    timestamptz NOT NULL DEFAULT now(),
        updated_at    timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (client_id, course),
        CHECK (exam_on > started_on)
      )`,
      `CREATE TABLE study_schedules (
        client_id      uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        effective_from timestamptz NOT NULL DEFAULT now(),
        time_zone      text NOT NULL CHECK (char_length(time_zone) BETWEEN 1 AND 64),
        study_days     smallint[] NOT NULL CHECK (cardinality(study_days) BETWEEN 1 AND 7 AND study_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
        PRIMARY KEY (client_id, effective_from)
      )`,
      `CREATE TABLE study_log (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        client_id  uuid NOT NULL REFERENCES clients (id) ON DELETE CASCADE,
        course     text NOT NULL CHECK (char_length(course) BETWEEN 1 AND 200),
        local_date date NOT NULL,
        minutes    smallint NOT NULL CHECK (minutes BETWEEN 1 AND 480),
        kind       text NOT NULL CHECK (kind IN ('reading', 'video', 'other')),
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX study_log_client_day_idx ON study_log (client_id, local_date)`,
      `CREATE FUNCTION study_log_day_cap() RETURNS trigger LANGUAGE plpgsql AS $fn$
      BEGIN
        PERFORM pg_advisory_xact_lock(hashtextextended(NEW.client_id::text || NEW.local_date::text, 0));
        IF NEW.minutes + COALESCE((SELECT sum(minutes) FROM study_log WHERE client_id = NEW.client_id AND local_date = NEW.local_date AND id <> NEW.id), 0) > 480 THEN
          RAISE EXCEPTION 'study_log: over 8 hours in a day' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
      END
      $fn$`,
      `CREATE TRIGGER study_log_day_cap BEFORE INSERT OR UPDATE ON study_log FOR EACH ROW EXECUTE FUNCTION study_log_day_cap()`,
    ],
  },
```

Tested 2026-11-22 on a disposable local Postgres 17 (production runs 18) after replaying every earlier migration:
applies through `--print`, changes no existing schema object, the constraints and 8-hour cap hold (12 concurrent
inserts too), deleting a client cascades, and the rollback leaves the schema as it was.

Rollback (loses whatever students entered):

```sql
DROP TABLE study_log, study_goals, study_schedules;
DROP FUNCTION study_log_day_cap();
DELETE FROM schema_migrations WHERE id = '077_accountability';
```

`078_study_checkins` (sent check-ins, one per student per week) comes with F5, after D4.

A saved time zone is checked against `pg_timezone_names` as well as `Intl`: one Postgres doesn't know would make
`AT TIME ZONE` throw.

## Preview setup (D7, before the branch is pushed)

1. Create an empty database in Neon (a database, not a branch: a branch copies its parent's data).
2. Set its URL as `DATABASE_URL` for Preview, branch `feature/accountability-loop` only. Confirm Vercel lets that
   override the integration's variable before pushing.
3. Run `npm run db:migrate` against it, then seed made-up students, one on a test Google account.
4. Register the branch alias's `/api/student/auth/google/callback` (and the admin one) in Google Cloud. Review on
   that alias, not a per-deploy URL. Email sign-in doesn't work there (no Resend key in Preview).

## Build order once approved

F1 plan and countdown → F2 score → F3 streak → F4 freeze and Earn Back → F5 tutor page. Each has its tests, a small
commit and a short summary. Portal Home and Study plan take rows and one headline number (`docs/brand.md`).

## Sources for Phase 2 copy

- May 2026 Level I: 39% overall, 45% first-time, 25% after at least one deferral.
  <https://www.cfainstitute.org/about/press-room/2026/results-for-cfa-program-level-i-testing-may-2026>
- Paid deferral ends from the February 2027 cycles; a candidate who doesn't sit forfeits the registration fee.
  <https://www.cfainstitute.org/about/press-room/2026/deferral-policies-update>
- The 45 vs 25 split is an association among people who sat. It doesn't show that staying on schedule causes a pass,
  and it is Level I only: word it that way, show it only to Level I, and show no fee amount we haven't sourced.
