"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Logo } from "@/core/components/layout/Logo";
import { LINKEDIN_GLYPH } from "@/core/components/ui/LinkedInFollow";
import { siteConfig } from "@/core/config/site";

import { signOutStudent } from "../actions/session";
import type { Tab } from "./StudentPortal";

// Familiar glyphs (Lucide-style, 24px, round stroke): house, video call, calendar, test sheet, graduation cap.
const ICONS: Partial<Record<Tab, string>> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  sessions: "M15 10l5-3v10l-5-3zM5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  plan: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  mocks: "M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 13l2 2 4-4M9 4V3h6v1",
  classroom: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5",
};
const HINTS: Partial<Record<Tab, string>> = { plan: "overdue", sessions: "awaiting confirmation" };

/** One page under a tab: another tab, or a page of its own (the notebook). */
export type SubItem = { label: string; tab?: Tab; href?: string };
export type NavItem = { id: Tab; label: string; subs?: SubItem[] };
type Tabs = { tabs: NavItem[]; active: Tab; badges: Partial<Record<Tab, number>>; onGo: (tab: Tab) => void };

/** Where a tab opens when tapped: its first page, or itself. */
const landing = (item: NavItem): Tab => item.subs?.find((s) => s.tab)?.tab ?? item.id;

function Glyph({ id, active, count }: { id: Tab; active: boolean; count: number }) {
  return (
    <span className="relative">
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.6} strokeLinecap="round" strokeLinejoin="round" className="size-6">
        <path d={ICONS[id]} />
      </svg>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-gold px-1 text-[10px] leading-none font-bold text-canvas">
          {count}
        </span>
      )}
    </span>
  );
}

const ITEM = "relative flex flex-col items-center justify-center gap-1 text-xs transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-quant";
const tone = (active: boolean, phone: boolean) => (active ? `font-semibold ${phone ? "text-gold" : "text-ink after:bg-gold"}` : "text-muted hover:text-ink");
const DESK = "h-16 min-w-20 px-3 after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full";
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
                <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`size-3 transition-transform ${open === item.id ? "rotate-180" : ""}`}>
                  <path d="m5 8 5 5 5-5" />
                </svg>
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

/** Inside a tab with pages, on every screen: a switch between them (phones have no menu to open). */
export function SubTabs({ item, active, onGo }: { item: NavItem; active: Tab; onGo: (tab: Tab) => void }) {
  if (!item.subs) return null;
  const pill = (on: boolean) =>
    `rounded-lg px-4 py-2 text-sm whitespace-nowrap transition-colors ${on ? "bg-gold/15 font-semibold text-gold" : "text-muted hover:text-ink"}`;
  return (
    <nav aria-label={item.label} className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-surface/60 p-1">
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
export function PortalBar({ me, readOnly, onAccount, ...tabs }: Tabs & { me: { name: string; email: string }; readOnly: boolean; onAccount: () => void }) {
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
          <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-muted">
            <path d="m5 8 5 5 5-5" />
          </svg>
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
              Hours &amp; payments
            </button>
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
