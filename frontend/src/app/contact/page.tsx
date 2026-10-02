import type { Metadata } from "next";
import Link from "next/link";

import { CosmicBackdrop } from "@/core/components/3d/CosmicBackdrop";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Finance in Practice or book a free 30-minute demo session.",
  alternates: { canonical: "/contact" },
};

const STEPS = [
  { title: "Book a free demo", body: "Pick a 30-minute slot that suits your timezone." },
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
    { label: "Free demo", value: "Book on the site", href: siteConfig.navCta.href, external: false },
    { label: "Calendar", value: "cal.com/raza141", href: calUrl, external: true },
    ...(email ? [{ label: "Email", value: email, href: `mailto:${email}`, external: true }] : []),
  ];

  return (
    <section aria-labelledby="contact-heading" className="relative -mt-20 overflow-hidden">
      <CosmicBackdrop className="absolute inset-0" tilt={0.6} zoom={7.5} />

      <div className="page-container relative flex min-h-screen flex-col justify-center py-32">
        <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Contact</p>
        <h1
          id="contact-heading"
          className="mt-6 max-w-3xl text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-7xl"
        >
          Let&rsquo;s talk about where you want to be
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Questions about a course, the free cohort or 1-on-1 sessions? The fastest route is a free
          demo call.
        </p>

        <ul className="mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
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
        </ul>

        <ol className="mt-12 grid max-w-4xl gap-6 border-t border-white/10 pt-8 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <span className="font-mono text-xs text-quant">0{i + 1}</span>
              <h2 className="mt-2 font-sans text-base font-semibold">{step.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12">
          <ButtonLink href={siteConfig.navCta.href} size="lg">
            {siteConfig.navCta.label}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
