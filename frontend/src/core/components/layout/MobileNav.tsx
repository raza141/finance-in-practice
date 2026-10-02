"use client";

import Link from "next/link";
import { useState } from "react";

import { siteConfig } from "@/core/config/site";

/** Below `md` the primary nav collapses into this disclosure menu. */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((value) => !value)}
        className="grid h-10 w-10 place-items-center rounded-md border border-line text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          {open ? (
            <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.6" />
          ) : (
            <path d="M2 5H16M2 9H16M2 13H16" stroke="currentColor" strokeWidth="1.6" />
          )}
        </svg>
      </button>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="absolute inset-x-0 top-16 border-b border-line bg-canvas/95 px-4 py-4 backdrop-blur-md"
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
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
