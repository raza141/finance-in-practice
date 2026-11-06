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

  const channels: { label: string; value: string; note?: string; href: string; external: boolean }[] = [
    {
      label: "WhatsApp",
      value: whatsapp.display,
      note: whatsapp.owner,
      href: `https://wa.me/${whatsapp.number}?text=${encodeURIComponent(whatsapp.greeting)}`,
      external: true,
    },
    { label: "Calendar", value: "cal.com/raza141", href: calUrl, external: true },
    ...(email ? [{ label: "Email", value: email, href: `mailto:${email}`, external: true }] : []),
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

          <ul className="mt-8 grid gap-3 sm:grid-cols-3">
            {channels.map((channel) => (
              <li key={channel.label}>
                <Link
                  href={channel.href}
                  {...(channel.external ? { target: "_blank", rel: "noreferrer" } : {})}
                  className="block h-full rounded-2xl border border-white/10 bg-canvas/50 p-5 backdrop-blur-md transition-colors hover:border-quant/50"
                >
                  <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{channel.label}</span>
                  <span className="mt-2 block text-base text-ink">{channel.value} ↗</span>
                  {channel.note && <span className="mt-1 block text-sm text-muted">{channel.note}</span>}
                </Link>
              </li>
            ))}
            <li className="rounded-2xl border border-white/10 bg-canvas/50 p-5 backdrop-blur-md">
              <span className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Where</span>
              <span className="mt-2 block text-base text-ink">{siteConfig.delivery.onsiteCity} · {siteConfig.delivery.onsiteArea}</span>
              <span className="mt-1 block text-sm text-muted">At your home, or live online across the UAE</span>
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
