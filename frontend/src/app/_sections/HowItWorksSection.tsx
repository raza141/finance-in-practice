import { BookSplitButton } from "@/core/components/ui/BookButton";
import { CalendarCheck, Map as MapIcon, Play } from "lucide-react";

import { SectionHeading } from "@/core/components/ui/SectionHeading";

const STEPS = [
  {
    title: "Book a free diagnostic",
    body: "30 minutes, at your home in Abu Dhabi, in Khalifa City or online. No card needed.",
    icon: CalendarCheck,
  },
  {
    title: "Get your plan",
    body: "We find your gaps and map the fastest route to exam day.",
    icon: MapIcon,
  },
  {
    title: "Start learning",
    body: "Live 1-on-1 sessions and exam-style practice, with your student portal in between.",
    icon: Play,
  },
];

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-heading" className="border-t border-line">
      <div className="page-container py-12 lg:py-16">
        <SectionHeading id="how-heading" title="Three steps to your first session" />
        {/* Progress rail across the three steps. */}
        <div aria-hidden className="mt-8 hidden h-0.5 rounded-full bg-line md:block">
          <span className="block h-full origin-left rounded-full bg-gradient-to-r from-quant to-gold" />
        </div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-4">
                <span className="grid h-12 w-12 place-items-center rounded-xl border border-gold/40 bg-surface-raised text-gold">
                  <step.icon aria-hidden strokeWidth={1.8} className="h-6 w-6" />
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
        <div className="mt-10">
          <BookSplitButton />
        </div>
      </div>
    </section>
  );
}
