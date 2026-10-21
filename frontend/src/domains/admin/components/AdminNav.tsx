"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AdminNavigation, type AdminGroup } from "../services/AdminNavigation";
import { AdminIcon } from "./AdminIcon";

export type NavBadges = Record<string, { count: number; label: string }>;

/**
 * The admin menu: groups with the current page marked. Wide screens get the
 * grouped column; phones a single scrolling strip without group headings.
 */
export function AdminNav({ groups, badges }: { groups: AdminGroup[]; badges: NavBadges }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:block md:space-y-5 md:overflow-visible md:pb-5">
      {groups.map((group) => (
        <div key={group.label} className="contents md:block">
          <p className="hidden px-3 pb-1.5 text-[11px] font-medium text-muted/70 md:block">{group.label}</p>
          <ul className="contents md:grid md:gap-0.5">
            {group.modules.map((module) => {
              const badge = badges[module.href];
              if (module.comingSoon) {
                return (
                  <li key={module.href} className="hidden md:block">
                    <span className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted/40">
                      <AdminIcon name={module.icon} />
                      <span className="flex-1">{module.label}</span>
                      <span className="text-[10px]">soon</span>
                    </span>
                  </li>
                );
              }
              const active = AdminNavigation.isActive(module.href, pathname);
              return (
                <li key={module.href} className="shrink-0">
                  <Link
                    href={module.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                      active ? "bg-quant/10 font-medium text-quant" : "text-muted hover:bg-surface-raised hover:text-ink"
                    }`}
                  >
                    {active && <span aria-hidden className="absolute top-1.5 bottom-1.5 left-0 hidden w-0.5 rounded-full bg-quant md:block" />}
                    <AdminIcon name={module.icon} />
                    <span className="flex-1">{module.label}</span>
                    {(badge?.count ?? 0) > 0 && (
                      <span
                        title={`${badge.count} ${badge.label}`}
                        className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 font-mono text-[11px] font-semibold text-canvas"
                      >
                        {badge.count}
                        <span className="sr-only"> {badge.label}</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
