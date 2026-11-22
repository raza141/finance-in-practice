import { BookOpen, CalendarClock, ChartLine, Check, ClipboardCheck, Clock, Flame, ShieldCheck, Snowflake, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { BUTTON, JOIN_BUTTON } from "@/domains/students/components/buttons";
import { ExamCountdown } from "@/domains/students/components/ExamCountdown";
import { TabButton } from "@/domains/students/components/StudentPortal";

import { removeStudyTime } from "../actions/study";
import { StreakEngine } from "../services/StreakEngine";
import { StudyFormat as F } from "../services/StudyFormat";
import type { StudentProgress } from "../services/StudyProgress";
import type { GoalOption, LogEntry } from "../types";
import { StudyGoalForm, StudyLogForm } from "./StudyForms";

const CARD = "min-w-0 rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";
const SUMMARY = "flex min-h-12 cursor-pointer items-center py-3 text-sm font-semibold text-quant focus-visible:outline-2 focus-visible:outline-quant";

/** The loop on the Study plan tab: onboarding until there's a goal, then one headline score over rows. */
export function StudyPanel({
  progress,
  options,
  log,
  today,
  showCountdown,
  canPractise,
  readOnly,
}: {
  progress: StudentProgress | null;
  options: GoalOption[];
  log: LogEntry[];
  today: string;
  /** False when the calendar below already counts down to their batch's exam. */
  showCountdown: boolean;
  canPractise: boolean;
  readOnly: boolean;
}) {
  if (!progress)
    return (
      <section aria-labelledby="goal-heading" className={CARD}>
        <h2 id="goal-heading" className="mb-5 text-2xl font-normal italic">
          Set your study goal
        </h2>
        <StudyGoalForm options={options} saved={null} today={today} readOnly={readOnly} />
      </section>
    );

  const { goal, plan, onTrack, streak, schedule, chapters } = progress;
  const band = onTrack && F.BAND[onTrack.band];
  const { earnBack } = streak;
  return (
    <section aria-labelledby="track-heading" className={CARD}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <h2 id="track-heading" className="text-2xl font-normal italic">
          Your progress
        </h2>
        {showCountdown && plan.daysLeft !== null && plan.daysLeft >= 0 && <ExamCountdown days={plan.daysLeft} hidden={goal.hideCountdown} readOnly={readOnly} />}
      </div>

      <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">On-Track score</span>
        <span className={`font-mono text-5xl font-bold tabular-nums ${band?.tone ?? "text-muted"}`}>{onTrack?.score ?? "New"}</span>
        {band && <span className={`font-semibold ${band.tone}`}>{band.label}</span>}
      </p>

      {earnBack && (
        <div role="status" className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-gold p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Flame aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-gold" />
            <p className="min-w-0 text-sm">
              <span className="block font-semibold text-ink">{`Earn Back your ${streak.current}-day streak`}</span>
              <span className="block text-muted">{`${earnBack.questionsLeft} questions or ${earnBack.minutesLeft} min by ${F.day(earnBack.until)}`}</span>
            </p>
          </div>
          {canPractise && (
            <TabButton tab="mocks" className={`${JOIN_BUTTON} min-h-11`}>
              Practise now
            </TabButton>
          )}
        </div>
      )}

      <dl className="mt-5 divide-y divide-line border-y border-line">
        <Row icon={Clock} label="Hours">{`${F.hours(plan.hoursDone)} of ${goal.targetHours} h`}</Row>
        {plan.perDay !== null && (
          <>
            <Row icon={CalendarClock} label="Today">
              {plan.restDay ? "Rest day" : plan.todayHours > 0 ? `${F.toDo(plan.todayHours)} left` : "Done"}
            </Row>
            <Row icon={ChartLine} label="Needed a study day">
              <span className={plan.overCapacity ? "text-gold underline decoration-dashed underline-offset-4" : ""}>
                {plan.overCapacity ? `${F.hours(plan.perDay)}, above your ${F.hours(goal.hoursPerDay)}` : F.hours(plan.perDay)}
              </span>
            </Row>
          </>
        )}
        {chapters.total > 0 && <Row icon={BookOpen} label="Chapters practised">{`${chapters.touched} of ${chapters.total}`}</Row>}
        <Row icon={ClipboardCheck} label="Accuracy, 14 days">
          {F.percent(progress.accuracy)}
        </Row>
        <Row icon={Flame} label="Streak">{`${F.count(streak.current, "day")} · best ${streak.best}`}</Row>
        <Row icon={Snowflake} label="Freezes this month">{`${streak.freezesLeft} of ${StreakEngine.FREEZES_A_MONTH} left`}</Row>
      </dl>

      <ul aria-label="Streak badges" className="mt-4 flex flex-wrap gap-2 text-xs">
        {streak.perfect && (
          <li className="inline-flex items-center gap-1.5 rounded-full border border-gold px-3 py-1 font-semibold text-gold">
            <ShieldCheck aria-hidden strokeWidth={1.75} className="size-4" />
            Perfect streak
          </li>
        )}
        {StreakEngine.MILESTONES.map((m) => {
          const reached = streak.best >= m;
          return (
            <li key={m} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${reached ? "border-emerald-400 text-emerald-300" : "border-line text-muted"}`}>
              {reached && <Check aria-hidden strokeWidth={1.75} className="size-4" />}
              {m} days
              <span className="sr-only">{reached ? "reached" : "not yet reached"}</span>
            </li>
          );
        })}
      </ul>

      <div className="mt-4 divide-y divide-line">
        <details>
          <summary className={SUMMARY}>Log study time</summary>
          <div className="pb-5">
            <StudyLogForm today={progress.today} readOnly={readOnly} />
            {log.length > 0 && (
              <ul className="mt-3 divide-y divide-line text-sm">
                {log.map((entry) => (
                  <li key={entry.id} className="flex min-h-11 items-center justify-between gap-3 py-1">
                    <span>{`${F.day(entry.date)} · ${entry.minutes} min · ${entry.kind}`}</span>
                    {!readOnly && (
                      <form action={removeStudyTime}>
                        <input type="hidden" name="id" value={entry.id} />
                        <button type="submit" className={`${BUTTON} min-h-11`}>
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </details>
        <details>
          <summary className={SUMMARY}>Edit study goal</summary>
          <div className="pt-1">
            <StudyGoalForm
              options={options}
              today={progress.today}
              readOnly={readOnly}
              saved={{
                course: goal.course,
                examOn: goal.examOn,
                startedOn: goal.startedOn,
                targetHours: goal.targetHours,
                hoursPerDay: goal.hoursPerDay,
                priorHours: goal.priorMinutes / 60,
                studyDays: schedule.days,
                timeZone: schedule.timeZone,
              }}
            />
          </div>
        </details>
      </div>
    </section>
  );
}

function Row({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-2 text-sm">
      <Icon aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-quant" />
      <dt className="text-muted">{label}</dt>
      <dd className="ml-auto min-w-0 text-right font-medium text-ink tabular-nums">{children}</dd>
    </div>
  );
}
