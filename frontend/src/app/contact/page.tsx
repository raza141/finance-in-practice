import { CalendarDays, ChevronRight, type LucideIcon, Mail, MapPin, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { FinanceBackdrop } from "@/core/components/backdrop/FinanceBackdrop";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { LinkedInFollow } from "@/core/components/ui/LinkedInFollow";
import { siteConfig } from "@/core/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Finance in Practice or book a free 30-minute diagnostic session.",
  alternates: { canonical: "/contact" },
};

const STEPS = [
  { title: "Book", body: "Pick a free 30-minute slot that suits you." },
  { title: "Diagnose", body: "We map where you are against your exam date or deadline." },
  { title: "Decide", body: "You get a plan and choose whether to continue. No obligation." },
] as const;

export default function ContactPage() {
  const { email, calUrl, whatsapp } = siteConfig.contact;

  const channels: { label: string; icon: LucideIcon; value: string; note?: string; href: string; external: boolean }[] = [
    {
      label: "WhatsApp",
      icon: MessageCircle,
      value: whatsapp.display,
      note: whatsapp.owner,
      href: `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(whatsapp.greeting)}`,
      external: true,
    },
    { label: "Calendar", icon: CalendarDays, value: "cal.com/raza141", href: calUrl, external: true },
    ...(email ? [{ label: "Email", icon: Mail, value: email, href: `mailto:${email}`, external: true }] : []),
  ];

  return (
    <section aria-labelledby="contact-heading" className="relative -mt-20 overflow-hidden">
      <FinanceBackdrop start="orderbook" dim className="absolute inset-0" />

      <div className="page-container relative grid gap-10 pt-28 pb-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-14 lg:pt-32 lg:pb-16">
        <div>
          <h1
            id="contact-heading"
            className="max-w-2xl text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-6xl"
          >
            Let&rsquo;s talk about where you want to be
          </h1>

          {/* One contact list, like a phone's contact card: icon, how, and what it opens. Not four loose tiles. */}
          <ul className="mt-8 max-w-xl divide-y divide-line overflow-hidden rounded-2xl border border-white/10 bg-canvas/60 backdrop-blur-md">
            {channels.map((channel) => (
              <li key={channel.label}>
                <Link
                  href={channel.href}
                  {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-quant"
                >
                  <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-xl ${channel.label === "WhatsApp" ? "bg-whatsapp/15 text-whatsapp" : "bg-surface-raised text-quant"}`}>
                    <channel.icon strokeWidth={1.75} className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-muted">{channel.label}</span>
                    <span className="block truncate text-ink">{channel.value}</span>
                    {channel.note && <span className="block text-xs text-muted">{channel.note}</span>}
                  </span>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
            <li className="flex items-center gap-4 px-5 py-4">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-raised text-quant">
                <MapPin strokeWidth={1.75} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted">Where</span>
                <span className="block text-ink">{siteConfig.delivery.onsiteCity} · {siteConfig.delivery.onsiteArea}</span>
                <span className="block text-xs text-muted">At your home, or live online across the UAE</span>
              </span>
            </li>
          </ul>
          <LinkedInFollow className="mt-6" />
        </div>

        <aside
          aria-labelledby="next-steps-heading"
          className="rounded-3xl border border-white/10 bg-surface/80 p-6 backdrop-blur-md sm:p-8"
        >
          <h2 id="next-steps-heading" className="font-mono text-xs tracking-[0.22em] text-quant uppercase">
            How it works
          </h2>
          <ol className="mt-6 space-y-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3">
                <span className="grid h-8 w-8 place-items-center rounded-full border border-quant/40 font-mono text-xs text-quant">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ButtonLink href={siteConfig.navCta.href} size="lg" className="mt-8 w-full">
            {siteConfig.navCta.label}
          </ButtonLink>
        </aside>
      </div>
    </section>
  );
}
