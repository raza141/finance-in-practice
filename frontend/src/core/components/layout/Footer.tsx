import Link from "next/link";

import { siteConfig } from "@/core/config/site";

import { Logo } from "./Logo";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-canvas/90">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo height={28} withWordmark />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Financial theory taught by a practitioner who builds the models.
            </p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
            {siteConfig.nav.map((item) => (
              <Link key={item.href} href={item.href} className="text-muted hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-10 space-y-3 border-t border-line pt-6 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-ink/90">{siteConfig.disclosures.regulatory}</p>
          <p>{siteConfig.disclosures.trademarks}</p>
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
