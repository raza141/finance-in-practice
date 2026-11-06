"use client";

import { Menu, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createPortal } from "react-dom";

import { BookButton } from "@/core/components/ui/BookButton";
import { siteConfig } from "@/core/config/site";

/**
 * Below `lg` the pill navbar collapses its links into this disclosure menu.
 * The panel is portalled to <body>: the pill's backdrop-filter (and animated
 * transform) would otherwise become the containing block for `position: fixed`.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-surface/80 text-ink shadow-lg backdrop-blur-md"
      >
        {open ? <X aria-hidden className="size-[18px]" /> : <Menu aria-hidden className="size-[18px]" />}
      </button>

      {open &&
        createPortal(
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="fixed inset-x-4 top-20 z-50 rounded-2xl border border-white/10 bg-surface/95 px-3 py-3 shadow-lg backdrop-blur-md"
        >
          <ul className="flex flex-col">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-3 text-base text-ink hover:bg-surface"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="mb-1 ml-3 border-l border-line pl-2">
                    {item.children.map((child) => (
                      <li key={child.label}>
                        <Link
                          href={child.href}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-2 py-2 text-sm text-muted hover:bg-surface hover:text-ink"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
          <Link
            href={siteConfig.studentBooking.href}
            onClick={() => setOpen(false)}
            className="mt-2 flex items-center justify-center gap-2 rounded-md border border-line px-2 py-3 text-base text-ink hover:bg-surface"
          >
            <UserRound aria-hidden strokeWidth={1.75} className="size-4 text-gold" />
            Student login
          </Link>
          <BookButton onClick={() => setOpen(false)} className="mt-2 w-full" />
        </nav>,
          document.body,
        )}
    </div>
  );
}
