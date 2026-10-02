import Link from "next/link";

import { siteConfig } from "@/core/config/site";

import type { Pillar } from "../types";

export function TrackCard({ pillar }: { pillar: Pillar }) {
  const waitlist = pillar.status === "waitlist";
  return (
    <article
      data-anim="pillar"
      className="group relative flex flex-col rounded-xl border border-line bg-surface p-6 transition-colors duration-300 hover:border-quant/50"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm text-quant">{pillar.index}</span>
        {waitlist && (
          <span className="rounded-full border border-quant/40 px-2.5 py-0.5 text-[11px] font-medium tracking-wide text-quant uppercase">
            Waitlist
          </span>
        )}
      </div>

      <h3 className="mt-5 text-xl leading-snug font-bold">{pillar.title}</h3>
      <p className="mt-1 text-xs tracking-wide text-muted uppercase">{pillar.audience}</p>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">{pillar.summary}</p>

      <ul className="mt-5 space-y-2 text-sm text-ink/90">
        {pillar.outcomes.map((outcome) => (
          <li key={outcome} className="flex gap-2">
            <span aria-hidden className="mt-2 h-px w-3 shrink-0 bg-quant" />
            {outcome}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-2">
        {pillar.tags.map((tag) => (
          <code
            key={tag}
            className="rounded bg-canvas px-2 py-1 font-mono text-[11px] text-quant/90"
          >
            {tag}
          </code>
        ))}
      </div>

      <Link
        href={siteConfig.bookingHref}
        className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink transition-colors hover:text-quant"
      >
        {waitlist ? "Register interest" : "Discuss in a free demo"}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </article>
  );
}
