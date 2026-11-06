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
        {/* A timeline, not three boxes: numbered stops on one rail (across on wide screens, down on phones). */}
        <ol className="relative mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
          <span aria-hidden className="absolute top-6 bottom-6 left-6 w-px bg-gradient-to-b from-quant via-line to-gold md:top-6 md:right-[16%] md:bottom-auto md:left-[16%] md:h-px md:w-auto md:bg-gradient-to-r" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative flex gap-5 md:flex-col md:items-center md:text-center">
              <span className={`relative grid size-12 shrink-0 place-items-center rounded-full border bg-canvas ${i === STEPS.length - 1 ? "border-gold text-gold" : "border-quant/60 text-quant"}`}>
                <step.icon aria-hidden strokeWidth={1.8} className="size-5" />
              </span>
              <div>
                <p className="font-mono text-xs tracking-[0.2em] text-muted uppercase">Step {i + 1}</p>
                <h3 className="mt-1 text-xl font-bold">{step.title}</h3>
                <p className="mt-2 max-w-xs text-muted md:mx-auto">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-12 flex md:justify-center">
          <BookSplitButton />
        </div>
      </div>
    </section>
  );
}
