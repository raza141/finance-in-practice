import { CourseFormat } from "../services/CourseFormat";
import type { CourseModule } from "../types";

/** Topics that carry the most marks. The full list lives on the course page. */
const SHOWN = 4;

/** Heaviest exam topics as labelled bars, so the reader sees where the marks are. Renders nothing without weights. */
export function WeightBars({ modules, className = "" }: { modules: CourseModule[]; className?: string }) {
  const bars = modules
    .flatMap((m) => {
      const share = CourseFormat.weightMidpoint(m.weight);
      return share === null ? [] : [{ title: m.title, weight: m.weight ?? "", share, top: m.priority === "high_priority" }];
    })
    .toSorted((a, b) => b.share - a.share);
  if (bars.length === 0) return null;
  // Fixed axis (at least 25% of the exam), so near-equal topics don't all draw as full bars.
  const axis = Math.max(25, bars[0]!.share);
  const rest = bars.length - SHOWN;

  return (
    <figure className={className}>
      <figcaption className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">Where the marks are</figcaption>
      <ul className="mt-3 grid gap-2.5">
        {bars.slice(0, SHOWN).map((bar) => (
          <li key={bar.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
            <span className="truncate text-ink/90">{bar.title}</span>
            <span className="tabular-data font-mono text-xs text-muted">{bar.weight}</span>
            <span aria-hidden className="col-span-2 h-1.5 rounded-full bg-line/60">
              <span
                style={{ width: `${(bar.share / axis) * 100}%` }}
                className={`block h-full rounded-full ${bar.top ? "bg-gold" : "bg-quant/60"}`}
              />
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && <p className="mt-3 text-xs text-muted">+ {rest} more {rest === 1 ? "topic" : "topics"} in the full curriculum</p>}
    </figure>
  );
}
