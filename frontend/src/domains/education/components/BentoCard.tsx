import Link from "next/link";

import { siteConfig } from "@/core/config/site";

import { STRESS_PREVIEW, type BentoService } from "../services/ServiceCatalog";

const SPAN: Record<BentoService["span"], string> = {
  4: "lg:col-span-4",
  8: "lg:col-span-8",
  12: "lg:col-span-12",
};

function CodeVisual() {
  return (
    <pre className="overflow-hidden rounded-lg border border-white/5 bg-canvas/80 p-3 font-mono text-[11px] leading-relaxed text-muted">
      <span className="text-quant">df</span> = load_positions(<span className="text-ink/80">&quot;book.xlsx&quot;</span>)
      {"\n"}
      <span className="text-quant">report</span> = df.pipe(clean).pipe(price)
      {"\n"}
      report.to_excel(<span className="text-ink/80">&quot;eod.xlsx&quot;</span>)  <span className="text-muted/60"># 2s</span>
    </pre>
  );
}

function StressVisual() {
  return (
    <ul className="tabular-data space-y-2 font-mono text-[11px]" aria-label="Equity shocks by stress scenario">
      {STRESS_PREVIEW.map((s) => (
        <li key={s.label} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2">
          <span className="text-muted">{s.label}</span>
          <span className="h-1.5 rounded-full bg-white/5">
            <span
              className="block h-full rounded-full bg-quant/70"
              style={{ width: `${Math.abs(s.shock) * 200}%` }}
            />
          </span>
          <span className="text-right text-ink/80">{Math.round(s.shock * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

function CurveVisual() {
  return (
    <svg viewBox="0 0 240 70" className="h-16 w-full" aria-hidden>
      <path d="M0 62 H240 M0 8 V62" stroke="var(--color-line)" fill="none" />
      <path
        d="M4 58 C 40 30, 70 22, 110 18 S 190 12, 236 10"
        stroke="var(--color-quant)"
        strokeWidth="1.8"
        fill="none"
      />
      {[20, 60, 110, 170, 230].map((x, i) => (
        <circle key={x} cx={x} cy={[45, 27, 18, 13, 10][i]} r="2.5" fill="var(--color-canvas)" stroke="var(--color-quant)" />
      ))}
    </svg>
  );
}

const VISUALS = { code: CodeVisual, stress: StressVisual, curve: CurveVisual, none: null };

export function BentoCard({ service }: { service: BentoService }) {
  const Visual = VISUALS[service.visual];
  return (
    <article
      id={service.id}
      data-anim="bento"
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#151E32] p-6 transition-colors duration-300 hover:border-quant/30 sm:p-7 ${SPAN[service.span]} ${
        service.waitlist ? "lg:flex-row lg:items-center lg:justify-between lg:gap-10" : ""
      }`}
    >
      <div className={service.waitlist ? "max-w-2xl" : ""}>
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs tracking-[0.18em] text-quant uppercase">{service.kicker}</p>
          {service.waitlist && (
            <span className="rounded-full border border-quant/40 px-2.5 py-0.5 font-mono text-[10px] tracking-wider text-quant uppercase">
              Waitlist
            </span>
          )}
        </div>
        <h3 className={`mt-3 font-bold ${service.span === 8 ? "text-2xl sm:text-3xl" : "text-xl"}`}>
          {service.title}
        </h3>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{service.summary}</p>
      </div>

      {Visual && (
        <div className="mt-6">
          <Visual />
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-2 ${service.waitlist ? "mt-6 lg:mt-0" : "mt-auto pt-6"}`}>
        {service.tags.map((tag) => (
          <code key={tag} className="rounded bg-canvas px-2 py-1 font-mono text-[11px] text-quant/90">
            {tag}
          </code>
        ))}
        <Link
          href={siteConfig.bookingHref}
          className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-quant"
        >
          {service.waitlist ? "Register interest" : "Discuss in a free diagnostic"}
          <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      </div>
    </article>
  );
}
