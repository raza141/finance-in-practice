import type { StudyPlanItem } from "../types";

const PLAN_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const MARK: Record<StudyPlanItem["status"], { icon: string; className: string }> = {
  done: { icon: "✓", className: "border-quant bg-quant text-canvas" },
  skipped: { icon: "–", className: "border-line bg-canvas text-muted" },
  planned: { icon: "", className: "border-line bg-canvas" },
};

/** The study plan the instructor keeps for this student in admin Clients; null items = couldn't load. */
export function StudyPlanTimeline({ items }: { items: StudyPlanItem[] | null }) {
  const next = items?.find((i) => i.status === "planned");
  return (
    <section aria-labelledby="plan-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="plan-heading" className="text-2xl font-normal italic">
          Your study plan
        </h2>
        {items && items.length > 0 && (
          <p className="text-sm text-muted">
            {items.filter((i) => i.status === "done").length} of {items.length} topics done
          </p>
        )}
      </div>
      {items === null ? (
        <p className="mt-3 text-sm text-muted">Couldn&rsquo;t load your study plan right now. Please refresh in a minute.</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Your instructor hasn&rsquo;t shared a plan yet. Topics, dates and study materials will appear here once they do.
        </p>
      ) : (
        <ol className="mt-5 grid gap-0">
          {items.map((item, index) => (
            <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
              {index < items.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-line" />}
              <span
                aria-hidden
                className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${
                  item === next ? "border-gold bg-gold/20" : MARK[item.status].className
                }`}
              >
                {MARK[item.status].icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  {item.dueOn ? PLAN_DAY.format(new Date(`${item.dueOn}T00:00:00Z`)) : "To be scheduled"}
                  {item === next && <span className="ml-2 font-semibold text-gold">Up next</span>}
                  <span className="sr-only"> · {item.status}</span>
                </p>
                <p className={`mt-0.5 font-semibold ${item.status === "skipped" ? "text-muted line-through" : "text-ink"}`}>{item.topic}</p>
                {item.note && <p className="mt-1 text-sm text-ink/80">{item.note}</p>}
                {item.materialUrl && (
                  <a href={item.materialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-quant hover:underline">
                    Open material ↗
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
