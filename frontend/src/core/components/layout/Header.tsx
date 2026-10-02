import Link from "next/link";

import { siteConfig } from "@/core/config/site";

import { ButtonLink } from "../ui/ButtonLink";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";

export function Header() {
  return (
    <header
      data-anim="nav"
      className="sticky top-0 z-50 border-b border-line/70 bg-canvas/80 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Finance in Practice home" className="shrink-0">
          <Logo height={26} withWordmark className="[&>span:last-child]:hidden sm:[&>span:last-child]:inline" />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {siteConfig.nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ButtonLink href={siteConfig.bookingHref} size="md">
            Book a Free Demo
          </ButtonLink>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
