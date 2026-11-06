import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { TabButton, type Tab } from "./StudentPortal";

/**
 * One line on the portal's Home, LinkedIn/banking-app style: icon, what it is, one detail; the whole row opens its tab.
 * `urgent` draws the icon box dashed gold (overdue, missing, to pay): colour plus shape, never colour alone.
 */
export function HomeRow({ tab, icon: Icon, title, detail, value, urgent = false }: { tab: Tab; icon: LucideIcon; title: ReactNode; detail?: ReactNode; value?: ReactNode; urgent?: boolean }) {
  return (
    <li>
      <TabButton
        tab={tab}
        className="group flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-quant"
      >
        <span
          aria-hidden
          className={`grid size-9 shrink-0 place-items-center rounded-lg ${urgent ? "border border-dashed border-gold text-gold" : "bg-surface-raised text-quant"}`}
        >
          <Icon strokeWidth={1.75} className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{title}</span>
          {detail && <span className="block truncate text-xs text-muted">{detail}</span>}
        </span>
        {value && <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">{value}</span>}
        <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-0.5" />
      </TabButton>
    </li>
  );
}

/** A Home panel: a title and its rows. */
export function HomePanel({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section aria-label={title} className={`rounded-3xl border border-white/10 bg-canvas/70 p-3 backdrop-blur-md sm:p-4 ${className}`}>
      <h2 className="px-3 pt-2 pb-1 text-lg font-normal italic">{title}</h2>
      <ul className="grid">{children}</ul>
    </section>
  );
}
