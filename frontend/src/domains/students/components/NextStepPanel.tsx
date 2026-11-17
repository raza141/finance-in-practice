import { ChevronDown, Clock, GraduationCap, type LucideIcon, RotateCcw, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { reportResult, requestCourse } from "../actions/courseMoves";
import type { AddableCourse, ExamResult, NextStep } from "../services/NextSteps";
import { NextSteps } from "../services/NextSteps";
import type { Student } from "../types";
import { BOOK_BUTTON, BUTTON } from "./buttons";

const PANEL = "rounded-3xl border border-ink/10 bg-canvas/70 p-3 backdrop-blur-md sm:p-4";
const ROW = "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5";
const QUIET = "font-mono text-xs text-muted underline-offset-2 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-quant";

function Icon({ icon: I }: { icon: LucideIcon }) {
  return (
    <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-raised text-quant">
      <I strokeWidth={1.75} className="size-[18px]" />
    </span>
  );
}

function Text({ title, detail }: { title: ReactNode; detail?: ReactNode }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-medium text-ink">{title}</span>
      {detail && <span className="block text-xs text-muted">{detail}</span>}
    </span>
  );
}

/** A row that unfolds to pick a sitting and send the request: the earliest sitting is picked already. */
function RequestRow({ icon, title, detail, course, sittings, retake, readOnly }: { icon: LucideIcon; title: string; detail?: string; course: string; sittings: string[] | null; retake: boolean; readOnly: boolean }) {
  if (sittings?.length === 0) return null;
  return (
    <li>
      <details className="group rounded-xl open:bg-ink/5">
        <summary className={`${ROW} cursor-pointer list-none transition-colors duration-150 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-quant [&::-webkit-details-marker]:hidden`}>
          <Icon icon={icon} />
          <Text title={title} detail={detail} />
          <ChevronDown aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
        </summary>
        {!readOnly && (
          <form action={requestCourse} className="grid gap-4 px-3 pt-1 pb-4 sm:pl-15">
            <input type="hidden" name="course" value={course} />
            <input type="hidden" name="retake" value={retake ? "1" : "0"} />
            {sittings ? (
              <fieldset className="grid gap-2">
                <legend className="mb-2 font-mono text-[11px] tracking-[0.2em] text-muted uppercase">Your sitting</legend>
                <div className="flex flex-wrap gap-2">
                  {sittings.map((s, i) => (
                    <label key={s} className="cursor-pointer">
                      <input type="radio" name="label" value={s} defaultChecked={i === 0} className="peer sr-only" />
                      <span className="inline-flex h-11 items-center rounded-full border border-line px-4 font-mono text-xs text-ink transition-colors duration-150 peer-checked:border-gold peer-checked:text-gold peer-focus-visible:outline-2 peer-focus-visible:outline-quant hover:bg-ink/5">
                        {s}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <input type="hidden" name="label" value="" />
            )}
            <div>
              <button type="submit" className={BOOK_BUTTON}>
                Send request
              </button>
            </div>
          </form>
        )}
      </details>
    </li>
  );
}

function WaitingRow({ course, label }: { course: string; label: string }) {
  return (
    <li className={ROW}>
      <Icon icon={Clock} />
      <Text title={label ? `${course} · ${label}` : course} />
      <span role="status" className="shrink-0 font-mono text-[11px] tracking-wide text-gold uppercase">
        Awaiting approval
      </span>
    </li>
  );
}

/**
 * After a sitting (Home, above every tab): the result, then the way on, with the same account.
 * Report Passed / Didn't pass, open a row, keep the earliest sitting, Send request: three taps.
 */
export function NextStepPanel({ student, steps, results, readOnly }: { student: Student; steps: NextStep[]; results: ExamResult[]; readOnly: boolean }) {
  const ended = student.ended.filter((e) => !e.paused);
  const paused = student.ended.filter((e) => e.paused);
  const open = ended.filter((e) => steps.length > 0 || !results.some((r) => r.course === e.course && r.label === e.label));
  if (open.length + paused.length + steps.length === 0) return null;
  const asked = steps.some((s) => s.kind === "waiting");
  return (
    <section aria-label="Your next step" className={PANEL}>
      <h2 className="px-3 pt-2 pb-1 text-lg font-normal italic">Your next step</h2>
      <ul className="grid divide-y divide-line/60">
        {ended.map((e) => {
          const result = results.find((r) => r.course === e.course && r.label === e.label);
          // Reported and nothing left to do (e.g. passed, Level II already open): no row above every tab.
          if (result && steps.length === 0) return null;
          return (
            <li key={e.course} className={`${ROW} flex-wrap`}>
              <Icon icon={GraduationCap} />
              <Text title={`${e.course} · ${e.label}`} detail={result ? (result.passed ? "Passed" : "Didn’t pass") : `Access ended ${e.ends}`} />
              {!readOnly && (
                <form action={reportResult} className="flex shrink-0 flex-wrap items-center gap-2">
                  <input type="hidden" name="course" value={e.course} />
                  <input type="hidden" name="label" value={e.label} />
                  {result ? (
                    !asked && (
                      <button type="submit" name="answer" value="undo" className={QUIET}>
                        Change
                      </button>
                    )
                  ) : (
                    <>
                      <button type="submit" name="answer" value="passed" className={BUTTON}>
                        Passed
                      </button>
                      <button type="submit" name="answer" value="failed" className={BUTTON}>
                        Didn&rsquo;t pass
                      </button>
                    </>
                  )}
                </form>
              )}
            </li>
          );
        })}
        {paused.map((e) => (
          <li key={e.course} className={ROW}>
            <Icon icon={GraduationCap} />
            <Text title={`${e.course} · ${e.label}`} />
            <span className="shrink-0 font-mono text-[11px] tracking-wide text-muted uppercase">Paused</span>
          </li>
        ))}
        {steps.map((s) =>
          s.kind === "move" ? (
            <RequestRow
              key={`${s.course}-move`}
              icon={s.retake ? RotateCcw : TrendingUp}
              title={s.retake ? `Retake ${s.course}` : `Start ${s.course}`}
              detail={s.retake ? `${NextSteps.RETAKE_DISCOUNT}% off your retake package` : undefined}
              course={s.course}
              sittings={s.sittings}
              retake={s.retake}
              readOnly={readOnly}
            />
          ) : s.kind === "waiting" ? (
            <WaitingRow key={`${s.course}-wait`} course={s.course} label={s.label} />
          ) : null,
        )}
      </ul>
    </section>
  );
}

/** Me → Add a course: every active course they don't have, as a request. */
export function AddCoursePanel({ addable, waiting, readOnly }: { addable: AddableCourse[]; waiting: { course: string; label: string }[]; readOnly: boolean }) {
  return (
    <section aria-label="Add a course" className={PANEL}>
      <h2 className="px-3 pt-2 pb-1 text-lg font-normal italic">Add a course</h2>
      {addable.length + waiting.length === 0 ? (
        <p className="px-3 pb-3 text-sm text-muted">You have every course we run.</p>
      ) : (
        <ul className="grid divide-y divide-line/60">
          {addable.map((a) => (
            <RequestRow key={a.course} icon={GraduationCap} title={a.course} course={a.course} sittings={a.sittings} retake={false} readOnly={readOnly} />
          ))}
          {waiting.map((w) => (
            <WaitingRow key={w.course} course={w.course} label={w.label} />
          ))}
        </ul>
      )}
    </section>
  );
}
