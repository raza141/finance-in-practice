import { ExamFacts } from "../services/ExamFacts";
import type { Course } from "../types";

/** Three big exam numbers and the latest pass rate with its window and source. Renders nothing for non-exam courses. */
export function ExamGlance({ ticker, className = "" }: { ticker: Course["testimonialTicker"]; className?: string }) {
  const exam = ExamFacts.for(ticker);
  if (!exam) return null;
  return (
    <div className={className}>
      <dl className="grid grid-cols-3 gap-3">
        {exam.facts.map((fact) => (
          <div key={fact.label} className="flex flex-col-reverse">
            <dt className="mt-1 text-xs text-muted">{fact.label}</dt>
            <dd className="tabular-data text-xl font-semibold text-ink sm:text-3xl">{fact.value}</dd>
          </div>
        ))}
      </dl>
      {exam.passRate && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-line bg-canvas/60 px-3 py-1 text-xs text-muted">
          <span className="font-semibold text-gold">{exam.passRate.value} pass rate</span>
          {exam.passRate.window} · {exam.passRate.source}
        </p>
      )}
    </div>
  );
}
