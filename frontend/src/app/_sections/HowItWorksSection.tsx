import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { LineIcon } from "@/core/components/ui/LineIcon";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { siteConfig } from "@/core/config/site";

const STEPS = [
  {
    title: "Book a free diagnostic",
    body: "30 minutes, in person in Abu Dhabi or online. No card needed.",
    icon: "M8 2v4M16 2v4M3 9h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm4 11 2 2 4-4",
  },
  {
    title: "Get your plan",
    body: "We find your gaps and map the fastest route to exam day.",
    icon: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Zm0 0v14m6-12v14",
  },
  {
    title: "Start learning",
    body: "Live 1-on-1 sessions, worked problems and the code behind them.",
    icon: "M5 3l14 9-14 9V3Z",
  },
];

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading id="how-heading" eyebrow="How it works" title="Three steps to your first session" />
        <ol data-anim="reveal" className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-gold/40 bg-gold/10 text-gold">
                  <LineIcon d={step.icon} />
                </span>
                <span className="font-mono text-4xl font-semibold text-quant/30">0{i + 1}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.body}</p>
              {i < STEPS.length - 1 && (
                <span aria-hidden className="absolute top-1/2 -right-[13px] z-10 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-full border border-line bg-canvas text-xs text-quant md:grid">
                  →
                </span>
              )}
            </li>
          ))}
        </ol>
        <div data-anim="reveal" className="mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-5">
          <ButtonLink href={siteConfig.bookingHref} size="lg" className="w-full sm:w-auto">
            Book a Diagnostic Session
          </ButtonLink>
          <p className="font-mono text-xs tracking-wide text-muted">Free · 30 min · no card needed</p>
        </div>
      </div>
    </section>
  );
}
