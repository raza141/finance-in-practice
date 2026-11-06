import { Lightbulb, Target, TrendingUp } from "lucide-react";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { MarketPulseCard } from "@/domains/market/components/MarketPulseCard";
import { MarketPulseSource } from "@/domains/market/server/MarketPulseSource";

/** Three reasons, one line each; the last one hands over to the live Market Pulse beside it. */
const POINTS = [
  {
    title: "Concept first",
    body: "The logic behind every formula, so you can rebuild it under exam pressure.",
    icon: Lightbulb,
  },
  {
    title: "A plan built around you",
    body: "Your exam date, weak topics and schedule set the pace. Nothing generic.",
    icon: Target,
  },
  {
    title: "Taught on real markets",
    body: "Every topic tied to live prices, rates and volatility, like this board.",
    icon: TrendingUp,
  },
];

export async function WhyUsSection() {
  const pulse = await MarketPulseSource.load();

  return (
    <section id="methodology" aria-labelledby="why-heading" className="border-t border-line">
      <div className="page-container py-12 lg:py-16">
        <SectionHeading id="why-heading" title="Theory that holds up in real markets" />

        {/* Wide screens: the reasons panel shares the Market Pulse card's height, so both columns end on one line. */}
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-2 lg:items-stretch xl:gap-16">
          {/* One panel, three rows: the reasons aren't a sequence, so no numbering; rows split the Market Pulse height evenly. */}
          <ul className="flex min-w-0 flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {POINTS.map((point) => (
              <li key={point.title} className="flex flex-1 items-center gap-5 p-6 sm:gap-6 sm:p-8">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-quant/30 bg-quant/10 text-quant">
                  <point.icon aria-hidden strokeWidth={1.8} className="h-6 w-6" />
                </span>
                <div>
                  <h3 className="text-xl font-bold">{point.title}</h3>
                  <p className="mt-1.5 max-w-md leading-relaxed text-muted">{point.body}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="min-w-0">
            <MarketPulseCard pulse={pulse} />
          </div>
        </div>
      </div>
    </section>
  );
}
