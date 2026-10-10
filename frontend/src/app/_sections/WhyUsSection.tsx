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
    <section id="methodology" aria-labelledby="why-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading id="why-heading" eyebrow="Why learn with us" title="Theory that holds up in real markets" />

        <div className="mt-12 grid items-start gap-10 lg:grid-cols-2 xl:gap-16">
          <ol data-anim="reveal" className="grid min-w-0 gap-4">
            {POINTS.map((point, i) => (
              <li key={point.title} className="flex gap-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-quant/30 bg-quant/10 text-quant">
                  <LineIcon d={point.icon} />
                </span>
                <div>
                  <p className="font-mono text-[11px] tracking-[0.16em] text-muted uppercase">0{i + 1}</p>
                  <h3 className="text-lg font-bold">{point.title}</h3>
                  <p className="mt-1.5 leading-relaxed text-muted">{point.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div data-anim="reveal" className="min-w-0">
            <MarketPulseCard pulse={pulse} />
          </div>
        </div>
      </div>
    </section>
  );
}
