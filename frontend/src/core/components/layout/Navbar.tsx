"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

import { NavLinkAnimator } from "@/core/animations/NavLinkAnimator";
import { siteConfig } from "@/core/config/site";

import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

/**
 * Fixed, top-centre floating "pill" navigation.
 *
 * Centred with `inset-x-0 mx-auto w-fit` rather than `-translate-x-1/2`: the
 * page-load timeline animates this element's translateY, and anime.js writes
 * `transform` inline, which would otherwise wipe out the horizontal centring.
 */
export function Navbar() {
  const [animator] = useState(() => new NavLinkAnimator());

  const onEnter = (event: MouseEvent<HTMLAnchorElement>) => animator.enter(event.currentTarget);
  const onLeave = (event: MouseEvent<HTMLAnchorElement>) => animator.leave(event.currentTarget);

  return (
    <header
      data-anim="nav"
      className="fixed inset-x-0 top-6 z-50 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-white/10 bg-[#151E32]/80 px-4 py-2 shadow-lg backdrop-blur-md"
    >
      <Link href="/" aria-label="Finance in Practice home" className="flex shrink-0 items-center pr-2">
        <Logo height={20} />
      </Link>

      <nav aria-label="Primary" className="hidden lg:block">
        <ul className="flex items-center">
          {siteConfig.nav.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onMouseEnter={onEnter}
                onMouseLeave={onLeave}
                onFocus={(e) => animator.enter(e.currentTarget)}
                onBlur={(e) => animator.leave(e.currentTarget)}
                className="relative block px-3 py-1.5 text-[13px] font-medium whitespace-nowrap outline-offset-4"
              >
                <span data-nav-label className="text-[#94A3B8]">
                  {item.label}
                </span>
                <span
                  data-nav-underline
                  aria-hidden
                  // Initial scale lives in `transform` (not Tailwind's scale-x-0, which
                  // uses the separate CSS `scale` property and would cancel anime's scaleX).
                  style={{ transform: "scaleX(0)" }}
                  className="absolute inset-x-3 bottom-0.5 h-px origin-center bg-quant shadow-[0_0_8px_rgb(34_211_238/0.8)]"
                />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <MobileNav />
    </header>
  );
}
