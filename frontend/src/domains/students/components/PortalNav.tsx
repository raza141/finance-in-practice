"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, GraduationCap, House, LogOut, type LucideIcon, Package, Receipt, Video } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";

import { Logo } from "@/core/components/layout/Logo";
import { LINKEDIN_GLYPH } from "@/core/components/ui/LinkedInFollow";
import { siteConfig } from "@/core/config/site";

import { signOutStudent } from "../actions/session";
import type { Tab } from "./StudentPortal";

// Lucide (docs/brand.md §6): the same shapes students know from LinkedIn, Google Classroom and Notion.
const ICONS: Partial<Record<Tab, LucideIcon>> = { home: House, sessions: Video, plan: CalendarDays, mocks: ClipboardCheck, classroom: GraduationCap };
const HINTS: Partial<Record<Tab, string>> = { plan: "overdue", sessions: "awaiting confirmation" };

/** One page under a tab: another tab, or a page of its own (the notebook). */
export type SubItem = { label: string; tab?: Tab; href?: string; icon?: LucideIcon; hint?: string };
export type NavItem = { id: Tab; label: string; subs?: SubItem[] };
type Tabs = { tabs: NavItem[]; active: Tab; badges: Partial<Record<Tab, number>>; onGo: (tab: Tab) => void };

/** Where a tab opens when tapped: its first page, or itself. */
const landing = (item: NavItem): Tab => item.subs?.find((s) => s.tab)?.tab ?? item.id;

function Glyph({ id, active, count }: { id: Tab; active: boolean; count: number }) {
  const Icon = ICONS[id] ?? House;
  return (
    <span className="relative">
      <Icon aria-hidden strokeWidth={active ? 2 : 1.6} className="size-[22px]" />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] leading-none font-bold text-canvas">
          {count}
        </span>
      )}
    </span>
  );
}

// Labels in the brand's label face (JetBrains Mono, small caps-style), short and quiet under the icon, Instagram-style.
const ITEM = "relative flex flex-col items-center justify-center gap-1 font-mono text-[10px] leading-none tracking-[0.12em] uppercase transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-quant";
const tone = (active: boolean, phone: boolean) => (active ? `font-semibold ${phone ? "text-gold" : "text-ink after:bg-gold"}` : "text-muted hover:text-ink");
const DESK = "h-16 min-w-18 px-2.5 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full";
const MENU_LINK = "block w-full rounded-lg px-3 py-2.5 text-left text-sm hover:bg-white/5";

/** Wide screens: a tab with pages opens a small menu under it (click, Esc or a click outside closes it). */
function DesktopNav({ tabs, active, badges, onGo }: Tabs) {
  const [open, setOpen] = useState<Tab | null>(null);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) && setOpen(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => (document.removeEventListener("pointerdown", close), document.removeEventListener("keydown", close));
  }, [open]);
  const pick = (tab: Tab) => (setOpen(null), onGo(tab));

  return (
    <nav ref={ref} aria-label="Student portal" className="absolute inset-y-0 left-1/2 hidden -translate-x-1/2 items-stretch lg:flex">
      {tabs.map((item) => {
        const lit = active === item.id;
        const count = badges[item.id] ?? 0;
        const label = (
          <>
            <Glyph id={item.id} active={lit} count={count} />
            <span className="flex items-center gap-0.5">
              {item.label}
              {item.subs && (
                <ChevronDown aria-hidden strokeWidth={2.5} className={`size-3 transition-transform ${open === item.id ? "rotate-180" : ""}`} />
              )}
            </span>
            {count > 0 && <span className="sr-only">, {count} {HINTS[item.id]}</span>}
          </>
        );
        if (!item.subs) {
          return (
            <button key={item.id} type="button" aria-current={lit ? "page" : undefined} onClick={() => pick(item.id)} className={`${ITEM} ${DESK} ${tone(lit, false)}`}>
              {label}
            </button>
          );
        }
        return (
          <div key={item.id} className="relative flex">
            <button
              type="button"
              aria-expanded={open === item.id}
              aria-current={lit ? "page" : undefined}
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className={`${ITEM} ${DESK} ${tone(lit, false)}`}
            >
              {label}
            </button>
            {open === item.id && (
              <div className="absolute top-full left-1/2 z-40 mt-1 w-56 -translate-x-1/2 rounded-2xl border border-line bg-surface p-2 text-ink shadow-2xl shadow-black/50">
                {item.subs.map((sub) =>
                  sub.href ? (
                    <a key={sub.label} href={sub.href} className={MENU_LINK}>
                      {sub.label}
                    </a>
                  ) : (
                    <button key={sub.label} type="button" onClick={() => pick(sub.tab!)} className={`${MENU_LINK} ${sub.tab === active ? "text-gold" : ""}`}>
                      {sub.label}
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/** Inside a tab with pages, from tablets up: a switch between them. Phones get SubRows and SubBack instead (no sideways scroll). */
export function SubTabs({ item, active, onGo }: { item: NavItem; active: Tab; onGo: (tab: Tab) => void }) {
  const box = useRef<HTMLElement>(null);
  // The gold highlight slides from the old page to the new one, like an iOS segmented control.
  const [mark, setMark] = useState<{ x: number; w: number } | null>(null);
  const labels = item.subs?.map((s) => s.label).join("|");
  useLayoutEffect(() => {
    const on = box.current?.querySelector<HTMLElement>('[aria-current="page"]');
    setMark(on ? { x: on.offsetLeft, w: on.offsetWidth } : null);
  }, [active, labels]);
  if (!item.subs) return null;
  const pill = (on: boolean) =>
    `relative z-10 rounded-lg px-4 py-2 text-sm whitespace-nowrap transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-quant ${on ? "font-semibold text-canvas" : "text-muted hover:text-ink"}`;
  return (
    <nav ref={box} aria-label={item.label} className="relative hidden w-fit max-w-full gap-1 overflow-x-auto rounded-xl md:flex border border-line bg-surface/60 p-1">
      {mark && (
        <span
          aria-hidden
          style={{ translate: `${mark.x}px 0`, width: mark.w }}
          className="absolute inset-y-1 left-0 rounded-lg bg-gold shadow-bevel-gold transition-[translate,width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        />
      )}
      {item.subs.map((sub) =>
        sub.href ? (
          <a key={sub.label} href={sub.href} className={pill(false)}>
            {sub.label}
          </a>
        ) : (
          <button key={sub.label} type="button" aria-current={sub.tab === active ? "page" : undefined} onClick={() => onGo(sub.tab!)} className={pill(sub.tab === active)}>
            {sub.label}
          </button>
        ),
      )}
    </nav>
  );
}

/** Phones, on a tab's first page: its other pages as rows near the thumb, under the content. */
export function SubRows({ item, active, onGo }: { item: NavItem; active: Tab; onGo: (tab: Tab) => void }) {
  if (!item.subs || active !== landing(item)) return null;
  const rest = item.subs.filter((s) => s.tab !== active);
  if (rest.length === 0) return null;
  const ROW = "flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-quant";
  const body = (sub: SubItem) => {
    const Icon = sub.icon ?? ClipboardCheck;
    return (
      <>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-raised text-quant">
          <Icon strokeWidth={1.75} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{sub.label}</span>
          {sub.hint && <span className="block text-xs text-muted">{sub.hint}</span>}
        </span>
        <ChevronRight aria-hidden strokeWidth={1.75} className="size-5 shrink-0 text-muted" />
      </>
    );
  };
  return (
    <nav aria-label={`More in ${item.label}`} className="md:hidden">
      <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">More in {item.label}</h2>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-canvas/70 backdrop-blur-md">
        {rest.map((sub) => (
          <li key={sub.label}>
            {sub.href ? (
              <a href={sub.href} className={ROW}>
                {body(sub)}
              </a>
            ) : (
              <button type="button" onClick={() => onGo(sub.tab!)} className={ROW}>
                {body(sub)}
              </button>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Phones, on any other page of a tab: one link back to the tab's first page. */
export function SubBack({ item, active, onGo }: { item: NavItem; active: Tab; onGo: (tab: Tab) => void }) {
  if (!item.subs || active === landing(item)) return null;
  return (
    <button type="button" onClick={() => onGo(landing(item))} className="-my-2 flex w-fit items-center gap-1 py-2 text-sm text-quant md:hidden">
      <ChevronLeft aria-hidden strokeWidth={2} className="size-4" />
      {item.label}
    </button>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const MENU_ITEM = "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/5";

/**
 * The portal's one bar, LinkedIn-style: logo left, the tabs (icon over label) in the middle on wide
 * screens, and a "Me" menu right with the account things. Under an admin's view-as strip it sits lower.
 */
export function PortalBar({ me, readOnly, onAccount, onPackage, ...tabs }: Tabs & { me: { name: string; email: string }; readOnly: boolean; onAccount: () => void; onPackage: (() => void) | null }) {
  return (
    <header className={`nav-line sticky z-30 bg-canvas bg-grid-lines bg-fixed ${readOnly ? "top-16" : "top-0"}`}>
      {/* A faint cyan-to-gold wash over the grid, so the bar reads as a bar. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-r from-quant/5 via-transparent to-gold/5" />
      <div className="page-container relative flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Finance in Practice website" className="shrink-0">
          <Logo height={30} priority />
        </Link>
        <DesktopNav {...tabs} />
        <button type="button" popoverTarget="me-menu" className="flex shrink-0 items-center gap-2 rounded-btn py-1 pr-1 pl-1.5 text-sm hover:bg-white/5">
          <span aria-hidden className="grid size-8 place-items-center rounded-full bg-quant/15 text-xs font-semibold text-quant">
            {initialsOf(me.name)}
          </span>
          <span className="hidden max-w-32 truncate text-ink sm:inline">{me.name.split(" ")[0]}</span>
          <ChevronDown aria-hidden className="size-4 text-muted" />
          <span className="sr-only">Account menu</span>
        </button>
        {/* Native popover: closes on Esc or a click outside, no script. */}
        <div
          id="me-menu"
          popover="auto"
          className={`inset-auto right-4 m-0 w-64 rounded-2xl border border-line bg-surface p-2 text-sm text-ink shadow-2xl shadow-black/50 ${readOnly ? "top-[8.5rem]" : "top-[4.5rem]"}`}
        >
          <div className="px-3 pt-2 pb-3">
            <p className="truncate font-semibold">{me.name}</p>
            <p className="truncate text-xs text-muted">{me.email}</p>
          </div>
          <div className="grid border-t border-line pt-1">
            <button type="button" popoverTarget="me-menu" popoverTargetAction="hide" onClick={onAccount} className={MENU_ITEM}>
              <Receipt aria-hidden className="size-4 text-muted" />
              Hours &amp; payments
            </button>
            {onPackage && (
              <button type="button" popoverTarget="me-menu" popoverTargetAction="hide" onClick={onPackage} className={MENU_ITEM}>
                <Package aria-hidden className="size-4 text-muted" />
                My package
              </button>
            )}
            <a href={siteConfig.contact.linkedinUrl} target="_blank" rel="noreferrer" className={MENU_ITEM}>
              <svg aria-hidden viewBox="0 0 24 24" className="size-4 fill-linkedin">
                <path d={LINKEDIN_GLYPH} />
              </svg>
              Follow us on LinkedIn
            </a>
          </div>
          {!readOnly && (
            <form action={signOutStudent} className="mt-1 border-t border-line pt-1">
              <button type="submit" className={`${MENU_ITEM} text-muted hover:bg-red-400/10 hover:text-red-300`}>
                <LogOut aria-hidden className="size-4" />
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}

/** Phones and tablets: the tabs as a bottom bar, thumb-reach, like the LinkedIn and Instagram apps. */
export function PortalTabBar(tabs: Tabs) {
  return (
    <nav aria-label="Student portal" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      {tabs.tabs.map((item) => {
        const lit = tabs.active === item.id;
        const count = tabs.badges[item.id] ?? 0;
        return (
          <button key={item.id} type="button" aria-current={lit ? "page" : undefined} onClick={() => tabs.onGo(landing(item))} className={`${ITEM} min-h-14 flex-1 ${tone(lit, true)}`}>
            <Glyph id={item.id} active={lit} count={count} />
            {item.label}
            {count > 0 && <span className="sr-only">, {count} {HINTS[item.id]}</span>}
          </button>
        );
      })}
    </nav>
  );
}
