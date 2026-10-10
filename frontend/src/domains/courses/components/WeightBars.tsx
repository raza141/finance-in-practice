import { CourseFormat } from "../services/CourseFormat";
import type { CourseModule } from "../types";

/** Exam weight by topic as a row of bars: the shape of the exam at a glance. Renders nothing without weights. */
export function WeightBars({ modules, className = "" }: { modules: CourseModule[]; className?: string }) {
  const bars = modules.flatMap((m) => {
    const share = CourseFormat.weightMidpoint(m.weight);
    return share === null ? [] : [{ title: m.title, weight: m.weight ?? "", share, top: m.priority === "high_priority" }];
  });
  if (bars.length === 0) return null;
  const max = Math.max(...bars.map((b) => b.share));

  return (
    <figure className={className}>
      <ul aria-label="Exam weight by topic" className="flex h-20 items-end gap-1.5">
        {bars.map((bar) => (
          <li
            key={bar.title}
            title={`${bar.title}: ${bar.weight}`}
            style={{ height: `${Math.max(12, (bar.share / max) * 100)}%` }}
            className={`flex-1 rounded-t-sm ${bar.top ? "bg-gold" : "bg-quant/50"}`}
          >
            <span className="sr-only">
              {bar.title}: {bar.weight}
            </span>
          </li>
        ))}
      </ul>
      <figcaption className="mt-2 flex justify-between font-mono text-[11px] tracking-wide text-muted uppercase">
        <span>{bars.length} topics · exam weight</span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-sm bg-gold" /> high priority
        </span>
      </figcaption>
    </figure>
  );
}
