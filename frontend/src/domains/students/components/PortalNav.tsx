import type { Tab } from "./StudentPortal";

const ICONS: Partial<Record<Tab, string>> = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  sessions: "M15 10l5-3v10l-5-3zM5 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
  plan: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4",
  mocks: "M7 4h10a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 13l2 2 4-4M9 4V3h6v1",
  classroom: "M2 9l10-5 10 5-10 5zM6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5",
};
const HINTS: Partial<Record<Tab, string>> = { plan: "overdue", sessions: "awaiting confirmation" };

function Item({ id, label, active, count, onGo, phone }: { id: Tab; label: string; active: boolean; count: number; onGo: (tab: Tab) => void; phone: boolean }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onGo(id)}
      className={`relative flex flex-col items-center justify-center gap-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-quant ${
        phone ? "min-h-14 flex-1" : "min-w-20 rounded-xl px-3 py-2 after:absolute after:inset-x-3 after:-bottom-1.5 after:h-0.5 after:rounded-full"
      } ${active ? `font-semibold ${phone ? "text-gold" : "text-ink after:bg-gold"}` : "text-muted hover:text-ink"}`}
    >
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
      {label}
      {count > 0 && <span className="sr-only">, {count} {HINTS[id]}</span>}
    </button>
  );
}

/** The portal's tabs, LinkedIn-style: icons with labels in a bar under the header on wide screens, a bottom tab bar on phones. */
export function PortalNav({ tabs, active, badges, onGo }: { tabs: [Tab, string][]; active: Tab; badges: Partial<Record<Tab, number>>; onGo: (tab: Tab) => void }) {
  const items = (phone: boolean) => tabs.map(([id, label]) => <Item key={id} id={id} label={label} active={active === id} count={badges[id] ?? 0} onGo={onGo} phone={phone} />);
  return (
    <>
      <nav aria-label="Student portal" className="nav-line sticky top-16 z-20 hidden gap-1 rounded-2xl border border-white/10 bg-canvas/90 bg-linear-to-r from-quant/5 via-transparent to-gold/5 px-2 pt-2 pb-3 backdrop-blur-md md:flex">
        {items(false)}
      </nav>
      <nav
        aria-label="Student portal"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {items(true)}
      </nav>
    </>
  );
}
