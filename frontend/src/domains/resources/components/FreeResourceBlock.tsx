import type { FreeResource } from "../services/ResourceCatalog";
import { LeadForm } from "./LeadForm";

/** Bar heights of the cover preview: the exam-map chart in miniature (five heavy topics, then the rest). */
const PREVIEW_BARS = [100, 92, 92, 92, 92, 55, 55, 55, 55, 74];

/** Lead magnet: a cover preview you can almost hold, three lines of value, and the email form. */
export function FreeResourceBlock({ resource, source, eyebrow = "Free download" }: { resource: FreeResource; source: string; eyebrow?: string }) {
  return (
    <div data-hide-bookbar className="grid items-center gap-10 rounded-3xl border border-line bg-surface p-7 sm:p-10 lg:grid-cols-[18rem_1fr] lg:gap-14">
      {/* Two stacked "pages" drawn in CSS: the CFA exam map cover in miniature. ponytail: use an image per resource once there is a second one. */}
      <div aria-hidden className="relative mx-auto h-72 w-56">
        <div className="absolute inset-0 translate-x-5 rotate-6 rounded-lg border border-white/10 bg-ink/90 shadow-2xl" />
        <div className="absolute inset-0 -rotate-3 overflow-hidden rounded-lg bg-white shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)]">
          <div className="bg-canvas px-4 pt-4 pb-3">
            <p className="font-mono text-[7px] tracking-[0.2em] text-quant uppercase">Free guide</p>
            <p className="mt-1 font-serif text-[15px] leading-tight font-bold text-white">
              CFA® Level I <span className="text-gold italic">Exam Map</span>
            </p>
          </div>
          <div className="grid grid-cols-4 gap-1 px-4 pt-3">
            {["180", "2×135", "300+", "43%"].map((v) => (
              <span key={v} className="rounded border border-slate-200 py-1 text-center font-mono text-[8px] font-bold text-slate-900">
                {v}
              </span>
            ))}
          </div>
          <div className="mt-3 grid gap-1.5 px-4">
            {PREVIEW_BARS.map((w, i) => (
              <span key={i} className={`h-1.5 rounded-sm ${i < 5 ? "bg-gold" : "bg-[#67b7c9]"}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
      </div>

      <div>
        <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">
          {eyebrow} · {resource.format}
        </p>
        <h3 className="mt-3 text-2xl font-bold sm:text-3xl">{resource.title}</h3>
        <ul className="mt-5 grid gap-2 text-ink/90">
          {resource.points.map((line) => (
            <li key={line} className="flex items-center gap-3">
              <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold text-[11px] text-canvas">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>
        <div className="mt-7 max-w-lg">
          <LeadForm resource={resource} source={source} />
        </div>
      </div>
    </div>
  );
}
