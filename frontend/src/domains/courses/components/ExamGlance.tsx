import { ExamFacts } from "../services/ExamFacts";
import type { Course } from "../types";

/** Three big exam numbers. Renders nothing for non-exam courses. */
export function ExamGlance({
  ticker,
  className = "",
}: {
  ticker: Course["testimonialTicker"];
  className?: string;
}) {
  const exam = ExamFacts.for(ticker);
  if (!exam) return null;
  return (
    <dl className={`flex gap-6 sm:gap-8 ${className}`}>
      {exam.facts.map((fact) => (
        <div key={fact.label} className="flex flex-col-reverse">
          <dt className="mt-1 text-xs text-muted">{fact.label}</dt>
          <dd data-course-anim="scramble" className="tabular-data text-xl font-semibold text-ink sm:text-3xl">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Rows for the course facts card: the next exam window with a countdown, and the latest pass rate with its window and source. */
export function examRows(ticker: Course["testimonialTicker"], now = new Date()): { label: string; value: string; note?: string }[] {
  const exam = ExamFacts.for(ticker);
  if (!exam) return [];
  // ponytail: evaluated at render; ISR (1h) keeps it fresh enough for month-level windows.
  const [next] = ExamFacts.nextWindows(exam, now, 1);
  return [
    ...(next ? [{ label: "Next exam", value: next.label, note: ExamFacts.countdown(next, now) }] : []),
    ...(exam.passRate ? [{ label: "Pass rate", value: exam.passRate.value, note: `${exam.passRate.window} · ${exam.passRate.source}` }] : []),
  ];
}
