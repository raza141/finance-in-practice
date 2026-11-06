import { StudyLine, type StudyLineNode } from "../services/StudyLine";
import type { StudyPlanItem } from "../types";
import { BUTTON } from "./buttons";

const PLAN_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const LINE_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });
const lineDay = (date: string) => LINE_DAY.format(new Date(`${date}T00:00:00Z`));

const MARK: Record<StudyPlanItem["status"], { icon: string; className: string }> = {
  done: { icon: "✓", className: "border-quant bg-quant text-canvas" },
  skipped: { icon: "–", className: "border-line bg-canvas text-muted" },
  planned: { icon: "", className: "border-line bg-canvas" },
};

/**
 * The portal's "Study plan & materials" tab: the plan the instructor keeps in
 * admin Clients, plus every attached material in one list. null items = couldn't load.
 */
export function StudyPlanTimeline({ items, programmes, exam }: { items: StudyPlanItem[] | null; programmes: string[]; exam: { course: string; date: string } | null }) {
  const next = items?.find((i) => i.status === "planned");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
  const line = StudyLine.build(items ?? [], exam, today);
  const materials = (items ?? []).filter((i) => i.materialUrl);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
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
        {line.length > 1 && <Line nodes={line} />}
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
                    <a href={item.materialUrl} target="_blank" rel="noreferrer" className={`${BUTTON} mt-2`}>
                      Open material
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="grid gap-6">
        <section aria-labelledby="programmes-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md">
          <h2 id="programmes-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
            Your programmes
          </h2>
          <ul className="mt-3 grid gap-2">
            {programmes.map((p) => (
              <li key={p} className="rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-sm font-semibold text-ink">
                {p}
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="materials-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md">
          <h2 id="materials-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
            Materials
          </h2>
          {materials.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Notes, documents and links your instructor shares will be listed here.</p>
          ) : (
            <ul className="mt-3 grid gap-2">
              {materials.map((m) => (
                <li key={m.id}>
                  <a
                    href={m.materialUrl!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-quant/50 hover:text-quant"
                  >
                    <span className="min-w-0 truncate">{m.topic}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}

/** The plan on one line: topics in date order, today, then exam day. Scrolls sideways when it's longer than the card. */
function Line({ nodes }: { nodes: StudyLineNode[] }) {
  const now = nodes.findIndex((n) => n.kind === "today");
  return (
    <div className="mt-5 overflow-x-auto pb-2">
      <ol className="flex w-full">
        {nodes.map((n, i) => (
          <li key={n.kind === "topic" ? n.id : n.kind} title={n.kind === "topic" ? n.topic : undefined} className="relative flex min-w-28 flex-1 flex-col items-center px-1 text-center">
            <span
              aria-hidden
              className={`absolute top-[1.625rem] h-0.5 ${i < now ? "bg-quant/70" : "bg-line"} ${i === 0 ? "left-1/2" : "left-0"} ${i === nodes.length - 1 ? "right-1/2" : "right-0"}`}
            />
            <span className="h-4 text-[11px] text-muted">{n.kind === "today" ? "" : lineDay(n.date)}</span>
            {n.kind === "topic" ? (
              <span
                aria-hidden
                className={`relative mt-1 grid h-5 w-5 place-items-center rounded-full border text-[10px] ${n.next ? "border-gold bg-gold/20" : MARK[n.status].className}`}
              >
                {MARK[n.status].icon}
              </span>
            ) : n.kind === "today" ? (
              <span aria-hidden className="relative mt-1 h-5 w-0.5 rounded-full bg-quant" />
            ) : (
              <span aria-hidden className="relative mt-1 h-5 w-5 rotate-45 rounded-sm border border-gold bg-gold" />
            )}
            <span
              className={`mt-2 line-clamp-2 text-xs ${
                n.kind === "today" ? "font-semibold text-quant" : n.kind === "exam" ? "font-semibold text-gold" : n.status === "skipped" ? "text-muted line-through" : n.next ? "font-semibold text-ink" : "text-ink/80"
              }`}
            >
              {n.kind === "topic" ? n.topic : n.kind === "today" ? "Today" : "Exam day"}
              <span className="sr-only">{n.kind === "topic" ? ` · ${n.status}` : ""}</span>
            </span>
            {n.kind === "exam" && <span className="text-[11px] text-muted">{n.days === 0 ? "today" : `in ${n.days} days`}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
