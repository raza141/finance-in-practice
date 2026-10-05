import Link from "next/link";
import type { ReactNode } from "react";

import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { Currency } from "@/domains/invoices/types";

import type { ChartBar } from "../services/DashboardMetrics";

const LABEL = "block font-mono text-[11px] tracking-[0.22em] text-muted uppercase";

/** One headline figure; the whole card links to where it is managed. */
export function StatCard({ label, value, sub, href, tone = "ink" }: { label: string; value: ReactNode; sub?: ReactNode; href: string; tone?: "ink" | "gold" | "quant" }) {
  const color = { ink: "text-ink", gold: "text-gold", quant: "text-quant" }[tone];
  return (
    <Link href={href} className="block h-full rounded-xl border border-line bg-surface p-5 transition-colors hover:border-quant/50">
      <span className={LABEL}>{label}</span>
      <span className={`tabular-data mt-2 block text-2xl leading-tight ${color}`}>{value}</span>
      {sub && <span className="mt-1.5 block text-xs text-muted">{sub}</span>}
    </Link>
  );
}

/** A titled block with an optional "view all" link. */
export function Panel({ title, href, linkLabel = "View all →", children, className = "" }: { title: string; href?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 className={LABEL}>{title}</h2>
        {href && (
          <Link href={href} className="text-xs text-quant hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/** Paid income per month as plain CSS bars, current month in gold. */
export function IncomeChart({ currency, bars }: { currency: Currency; bars: readonly ChartBar[] }) {
  const max = Math.max(...bars.map((b) => b.totalMinor), 1);
  return (
    <figure>
      <div className="flex h-40 items-end gap-3" role="img" aria-label={`Income paid per month in ${currency}, last six months`}>
        {bars.map((bar, i) => {
          const current = i === bars.length - 1;
          return (
            <div key={bar.month} className="flex h-full flex-1 flex-col justify-end" title={`${bar.label}: ${InvoiceMath.money(bar.totalMinor, currency)}`}>
              <div className={`min-h-[2px] rounded-t ${current ? "bg-gold" : "bg-quant/50"}`} style={{ height: `${(bar.totalMinor / max) * 100}%` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3">
        {bars.map((bar) => (
          <span key={bar.month} className="flex-1 text-center font-mono text-[10px] text-muted uppercase">
            {bar.label}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 text-xs text-muted">
        Paid invoices, {currency}. Peak {InvoiceMath.money(max === 1 ? 0 : max, currency)}.
      </figcaption>
    </figure>
  );
}
