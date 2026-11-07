import Link from "next/link";

import { LinkedInFollow } from "@/core/components/ui/LinkedInFollow";
import { siteConfig, type NavItem } from "@/core/config/site";

import { Logo } from "./Logo";

const external = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {});

function FooterLink({ item, className }: { item: NavItem; className?: string }) {
  return (
    <Link href={item.href} {...external(item.href)} className={`text-muted transition-colors hover:text-ink ${className ?? ""}`}>
      {item.label}
    </Link>
  );
}

const { whatsapp } = siteConfig.contact;
/** The WhatsApp line joins the Contact column, built from the one number in config. */
const groups = siteConfig.footerGroups.map((g) =>
  g.title === "Contact"
    ? {
        ...g,
        links: [
          g.links[0],
          {
            label: `WhatsApp ${whatsapp.display}`,
            href: `https://wa.me/${whatsapp.number}`,
          },
          ...g.links.slice(1),
        ],
      }
    : g,
);

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-canvas/90">
      <div className="page-container pt-14 pb-8">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,22rem)_auto] lg:justify-between">
          <div>
            <Logo height={40} />
            <p className="mt-4 text-sm leading-relaxed text-muted">Financial theory taught by a practitioner who builds the models.</p>
            <LinkedInFollow variant="pill" className="mt-6" />
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-10 sm:grid-cols-3 lg:gap-x-20">
            {groups.map((group) => (
              <div key={group.title}>
                <h2 className="font-mono text-[11px] tracking-[0.22em] text-quant uppercase">{group.title}</h2>
                <ul className="mt-4 space-y-1 text-sm">
                  {group.links.map((item) => (
                    <li key={item.href}>
                      <FooterLink item={item} className="inline-block py-1" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-12 space-y-3 border-t border-line pt-8 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-ink/90">{siteConfig.disclosures.regulatory}</p>
          <p className="max-w-5xl">{siteConfig.disclosures.trademarks}</p>
        </div>

        <div data-hide-bookbar className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-6 text-xs text-muted">
          <p>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <ul className="flex gap-6">
            {siteConfig.legalNav.map((item) => (
              <li key={item.href}>
                <FooterLink item={item} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
