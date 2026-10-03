"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

import { NavLinkAnimator } from "@/core/animations/NavLinkAnimator";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { TiltSurface } from "@/core/components/ui/TiltSurface";
import { siteConfig } from "@/core/config/site";

import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

/**
 * Fixed top bar: logo pinned to the top-left gutter, floating "pill" of links
 * centred on lg+, menu button on the right below lg.
 *
 * The full-width header is click-through (`pointer-events-none`) so the empty
 * space between logo and pill never blocks the page; only its children take
 * clicks. The page-load timeline animates this element's translateY, which is
 * why the pill is centred with the separate CSS `translate` property instead.
 */
export function Navbar() {
  const [animator] = useState(() => new NavLinkAnimator());

  const onEnter = (event: MouseEvent<HTMLAnchorElement>) =>
    animator.enter(event.currentTarget);
  const onLeave = (event: MouseEvent<HTMLAnchorElement>) =>
    animator.leave(event.currentTarget);

  return (
    <header
      data-anim="nav"
      className="pointer-events-none fixed inset-x-0 top-6 z-50"
    >
      <div className="page-container relative flex h-[46px] items-center justify-between">
        <Link
          href="/"
          aria-label="Finance in Practice home"
          className="pointer-events-auto flex shrink-0 items-center"
        >
          <Logo height={34} priority />
        </Link>

        <TiltSurface
          maxTilt={3}
          className="pointer-events-auto absolute top-0 left-1/2 hidden -translate-x-1/2 lg:block"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#151E32]/80 px-3 py-2 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] backdrop-blur-md">
            <nav aria-label="Primary">
              <ul className="flex items-center">
                {siteConfig.nav.map((item) => (
                  <li key={item.href} className="group relative">
                    <Link
                      href={item.href}
                      onMouseEnter={onEnter}
                      onMouseLeave={onLeave}
                      onFocus={(e) => animator.enter(e.currentTarget)}
                      onBlur={(e) => animator.leave(e.currentTarget)}
                      aria-haspopup={item.children ? "true" : undefined}
                      className="relative flex items-center gap-1 px-3 py-1.5 text-[13px] font-medium whitespace-nowrap outline-offset-4"
                    >
                      <span data-nav-label className="text-[#94A3B8]">
                        {item.label}
                      </span>
                      {item.children && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          aria-hidden
                          className="text-muted transition-transform duration-200 group-focus-within:rotate-180 group-hover:rotate-180"
                        >
                          <path
                            d="M2 3.5L5 6.5L8 3.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.4"
                          />
                        </svg>
                      )}
                      <span
                        data-nav-underline
                        aria-hidden
                        // Initial scale lives in `transform` (not Tailwind's scale-x-0, which
                        // uses the separate CSS `scale` property and would cancel anime's scaleX).
                        style={{ transform: "scaleX(0)" }}
                        className="absolute inset-x-3 bottom-0.5 h-px origin-center bg-quant shadow-[0_0_8px_rgb(34_211_238/0.8)]"
                      />
                    </Link>

                    {item.children && (
                      // pt-3 bridges the gap so the pointer can travel into the panel.
                      <div className="invisible absolute top-full left-1/2 -translate-x-1/2 pt-3 opacity-0 transition-[opacity,visibility] duration-200 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                        <ul className="min-w-52 rounded-2xl border border-white/10 bg-[#151E32]/95 p-2 shadow-xl backdrop-blur-md">
                          {item.children.map((child) => (
                            <li key={child.label}>
                              <Link
                                href={child.href}
                                className="block rounded-lg px-3 py-2 text-[13px] whitespace-nowrap text-muted transition-colors hover:bg-white/5 hover:text-ink"
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            <ButtonLink
              href={siteConfig.navCta.href}
              className="ml-1 hidden h-8 rounded-full px-4 text-[13px] lg:inline-flex"
            >
              {siteConfig.navCta.label}
            </ButtonLink>
          </div>
        </TiltSurface>

        <div className="pointer-events-auto">
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
