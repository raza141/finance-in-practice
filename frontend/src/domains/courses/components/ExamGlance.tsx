import { ExamFacts } from "../services/ExamFacts";
import type { Course } from "../types";

/** Three big exam numbers and the latest pass rate with its window and source. Renders nothing for non-exam courses. */
export function ExamGlance({
  ticker,
  className = "",
}: {
  ticker: Course["testimonialTicker"];
  className?: string;
}) {
  const exam = ExamFacts.for(ticker);
  if (!exam) return null;
  // ponytail: evaluated at render; ISR (1h) keeps it fresh enough for month-level windows.
  const windows = ExamFacts.nextWindows(exam, new Date());
  return (
    <div className={className}>
      <dl className="grid grid-cols-3 gap-3">
        {exam.facts.map((fact) => (
          <div key={fact.label} className="flex flex-col-reverse">
            <dt className="mt-1 text-xs text-muted">{fact.label}</dt>
            <dd className="tabular-data text-xl font-semibold text-ink sm:text-3xl">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        {windows.length > 0 && (
          <p className="inline-flex items-center gap-2 rounded-full border border-quant/30 bg-quant/10 px-3 py-1 text-xs text-ink">
            <span className="font-semibold text-quant">Next exams</span>
            {windows.map((w) => w.label).join(" · ")}
          </p>
        )}
        {exam.passRate && (
          <p className="inline-flex items-center gap-2 rounded-full border border-line bg-canvas/60 px-3 py-1 text-xs text-muted">
            <span className="font-semibold text-gold">
              {exam.passRate.value} pass rate
            </span>
            {exam.passRate.window} · {exam.passRate.source}
          </p>
        )}
      </div>
    </div>
  );
}
