import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { MarketPulseCard } from "@/domains/market/components/MarketPulseCard";
import { MarketPulseSource } from "@/domains/market/server/MarketPulseSource";

const POINTS = [
  {
    title: "Theory Before Execution",
    body: "Understand the economic and financial logic before applying a formula, solving a question or building a model.",
  },
  {
    title: "Mandate-Specific Instruction",
    body: "Your study plan is shaped around your exam, course, technical project or professional objective.",
  },
  {
    title: "Visible Assumptions",
    body: "Learn to inspect inputs, challenge outputs and explain what would cause a conclusion to change.",
  },
];

export async function WhyUsSection() {
  const pulse = await MarketPulseSource.load();

  return (
    <section id="methodology" aria-labelledby="why-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading
          id="why-heading"
          eyebrow="Why learn with us · Market Intelligence"
          title="Where Financial Theory Meets Market Reality"
          lede="At Finance in Practice, you learn the theory behind the calculation, the market context behind the number and the assumptions that determine whether a conclusion can be trusted."
        />

        <div className="mt-14 grid items-start gap-12 lg:grid-cols-2 xl:gap-16">
          <div data-anim="reveal">
            <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">Why learn with us</p>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">Build Understanding that Compounds</h3>
            <ol className="mt-8 grid gap-7">
              {POINTS.map((point, i) => (
                <li key={point.title}>
                  <p className="font-mono text-sm">
                    <span className="text-quant">{`0${i + 1} //`}</span> <span className="font-semibold text-ink">{point.title}</span>
                  </p>
                  <p className="mt-2 leading-relaxed text-muted">{point.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-9 border-l-2 border-quant pl-4 font-mono text-xs leading-relaxed tracking-wide uppercase">
              <span className="text-muted">Knowledge objective:</span>{" "}
              <span className="text-ink">Convert theory into independent analytical capacity</span>
            </p>
            <Link href="/courses" className="mt-6 inline-block font-mono text-sm text-quant hover:underline">
              Learning Tracks →
            </Link>
          </div>

          <div data-anim="reveal">
            <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">Market Pulse</p>
            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">The Market is the Case Study</h3>
            <p className="mt-3 leading-relaxed text-muted">
              Selected indicators across developed, emerging and frontier markets provide a practical reference point
              for understanding volatility, rates, returns and market regimes.
            </p>
            <div className="mt-6">
              <MarketPulseCard pulse={pulse} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
