"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";

import { NavLinkAnimator } from "@/core/animations/NavLinkAnimator";
import { BookButton } from "@/core/components/ui/BookButton";
import { TiltSurface } from "@/core/components/ui/TiltSurface";
import { siteConfig } from "@/core/config/site";

import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

/**
 * Fixed top bar: logo pinned to the top-left gutter, floating "pill" of links
 * centred on lg+, menu button on the right below lg. A 1fr/auto/1fr grid
 * centres the pill but never lets it overlap the logo when space is tight.
 *
 * The full-width header is click-through (`pointer-events-none`) so the empty
 * space between logo and pill never blocks the page; only its children take
 * clicks.
 */
export function Navbar() {
  const [animator] = useState(() => new NavLinkAnimator());
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onEnter = (event: MouseEvent<HTMLAnchorElement>) =>
    animator.enter(event.currentTarget);
  const onLeave = (event: MouseEvent<HTMLAnchorElement>) =>
    animator.leave(event.currentTarget);

  return (
    <header
      data-anim="nav"
      className="pointer-events-none fixed inset-x-0 top-6 z-50"
    >
      {/* Backdrop so page text never scrolls under the logo: always below lg (no pill there), on lg+ once the page scrolls. */}
      <div
        aria-hidden
        className={`absolute inset-x-0 -top-6 bottom-[-12px] border-b border-white/5 bg-canvas/85 backdrop-blur-md transition-opacity duration-300 ${scrolled ? "" : "lg:opacity-0"}`}
      />
      <div className="page-container relative grid h-[46px] grid-cols-[1fr_auto] items-center gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Link
          href="/"
          aria-label="Finance in Practice home"
          className="pointer-events-auto flex min-w-max items-center justify-self-start"
        >
          <Logo height={34} priority />
        </Link>

        <TiltSurface
          maxTilt={3}
          className="pointer-events-auto hidden lg:block"
        >
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-[#151E32]/80 px-3 py-2 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.7)] backdrop-blur-md">
            <nav aria-label="Primary">
              <ul className="flex items-center">
                {siteConfig.nav.map((item) => {
                  // The current page keeps its underline lit, so it skips the hover animator (which would dim it on leave).
                  const active = isActive(item.href);
                  return (
                    // Logo already links home, so "Home" only shows once there is room (xl+).
                    <li key={item.href} className={`group relative ${item.href === "/" ? "hidden xl:block" : ""}`}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onMouseEnter={active ? undefined : onEnter}
                        onMouseLeave={active ? undefined : onLeave}
                        onFocus={active ? undefined : (e) => animator.enter(e.currentTarget)}
                        onBlur={active ? undefined : (e) => animator.leave(e.currentTarget)}
                        aria-haspopup={item.children ? "true" : undefined}
                        className="relative flex items-center gap-1 px-2 py-1.5 text-[13px] xl:px-3 font-medium whitespace-nowrap outline-offset-4"
                      >
                        <span data-nav-label className={active ? "text-ink" : "text-[#94A3B8]"}>
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
                          style={{ transform: active ? "scaleX(1)" : "scaleX(0)" }}
                          className="absolute inset-x-2 bottom-0.5 h-px xl:inset-x-3 origin-center bg-quant shadow-[0_0_8px_rgb(34_211_238/0.8)]"
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
                  );
                })}
              </ul>
            </nav>

            <BookButton className="ml-1 hidden h-8 rounded-full px-4 text-[13px] lg:inline-flex" />
          </div>
        </TiltSurface>

        <div className="pointer-events-auto flex items-center gap-3 justify-self-end">
          {/* Portal entry for enrolled students: reads as a door, not another nav link. */}
          <Link
            href={siteConfig.studentBooking.href}
            aria-current={isActive(siteConfig.studentBooking.href) ? "page" : undefined}
            className="group hidden h-11 items-center gap-2.5 rounded-full border border-gold/30 bg-[#151E32]/80 py-1 pr-4 pl-1 shadow-lg backdrop-blur-md transition-colors hover:border-gold/70 aria-[current=page]:border-gold/70 lg:inline-flex"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gold/15 text-gold transition-colors group-hover:bg-gold group-hover:text-canvas">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
                <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-semibold text-ink">Student portal</span>
              <span className="text-[11px] text-muted">Sign in</span>
            </span>
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
