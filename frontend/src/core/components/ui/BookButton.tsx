"use client";

import { useId, type ComponentProps, type CSSProperties, type MouseEvent } from "react";

import { siteConfig } from "@/core/config/site";

import { ButtonLink } from "./ButtonLink";
import { RAISED_GOLD } from "./buttonStyles";

/** Fired on `window` so the booking widget can pre-select a course; detail is a booking TrackId. */
export const BOOK_TRACK_EVENT = "book:track";

const TRACKS = [
  { track: "cfa", label: "CFA Level I & II" },
  { track: "frm", label: "FRM Part I" },
  { track: "uni", label: "University finance" },
  { track: "systems", label: "Python & automation" },
];

type BookButtonProps = Omit<ComponentProps<typeof ButtonLink>, "href" | "children"> & { label?: string; track?: string };

/**
 * The one booking CTA. Pages with their own `#book` panel (home, courses,
 * consulting) scroll to it in place; every other page goes to the home panel.
 */
export function BookButton({ label = siteConfig.navCta.label, track, onClick, ...props }: BookButtonProps) {
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    const panel = document.getElementById("book");
    if (!panel) return;
    event.preventDefault();
    panel.scrollIntoView({ behavior: "smooth" });
    history.replaceState(null, "", "#book");
    if (track) window.dispatchEvent(new CustomEvent(BOOK_TRACK_EVENT, { detail: track }));
  };
  return (
    <ButtonLink {...props} href={siteConfig.navCta.href} onClick={go}>
      {label}
    </ButtonLink>
  );
}

/** The booking CTA with a chevron that picks the course first. Picking closes the menu (links don't light-dismiss a popover). */
export function BookSplitButton() {
  const id = useId();
  const menu = `book-menu-${id}`;
  return (
    <div className="flex items-center gap-1" style={{ "--split-anchor": `--book-${id.replace(/\W/g, "")}` } as CSSProperties}>
      <BookButton size="lg" className="flex-1 rounded-l-full rounded-r-none sm:flex-none" />
      <button
        type="button"
        popoverTarget={menu}
        aria-label="Choose a course to book"
        className={`split-toggle grid size-12 shrink-0 place-items-center rounded-full ${RAISED_GOLD}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-5 transition-[rotate] duration-200 motion-reduce:transition-none">
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div
        id={menu}
        popover="auto"
        onClick={(event) => event.currentTarget.hidePopover()}
        className="split-menu w-60 rounded-2xl border border-line bg-surface p-1.5 text-ink shadow-2xl"
      >
        {TRACKS.map(({ track, label }) => (
          <BookButton key={track} variant="ghost" track={track} label={label} className="h-11 w-full justify-start rounded-xl px-3 hover:bg-quant/10" />
        ))}
      </div>
    </div>
  );
}
