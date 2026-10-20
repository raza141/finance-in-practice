import { LineIcon } from "@/core/components/ui/LineIcon";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { MarketPulseCard } from "@/domains/market/components/MarketPulseCard";
import { MarketPulseSource } from "@/domains/market/server/MarketPulseSource";

/** Three reasons, one line each; the last one hands over to the live Market Pulse beside it. */
const POINTS = [
  {
    title: "Concept first",
    body: "The logic behind every formula, so you can rebuild it under exam pressure.",
    icon: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z",
  },
  {
    title: "A plan built around you",
    body: "Your exam date, weak topics and schedule set the pace. Nothing generic.",
    icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z",
  },
  {
    title: "Taught on real markets",
    body: "Every topic tied to live prices, rates and volatility, like this board.",
    icon: "M3 3v18h18M7 15l4-4 3 3 6-6M16 8h4v4",
  },
];

export async function WhyUsSection() {
  const pulse = await MarketPulseSource.load();

  return (
    <section id="methodology" aria-labelledby="why-heading" className="border-t border-line">
      <div className="page-container py-12 lg:py-16">
        <SectionHeading id="why-heading" eyebrow="Why learn with us" title="Theory that holds up in real markets" />

        {/* Wide screens: the reasons panel shares the Market Pulse card's height, so both columns end on one line. */}
        <div className="mt-8 grid items-start gap-10 lg:grid-cols-2 lg:items-stretch xl:gap-16">
          {/* One panel, three rows: the reasons aren't a sequence, so no numbering; rows split the Market Pulse height evenly. */}
          <ul className="flex min-w-0 flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {POINTS.map((point) => (
              <li key={point.title} className="flex flex-1 items-center gap-5 p-6 sm:gap-6 sm:p-8">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-quant/30 bg-quant/10 text-quant">
                  <LineIcon d={point.icon} />
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
