import { SectionHeading } from "@/core/components/ui/SectionHeading";

const STEPS = [
  { title: "Book a free demo", body: "A 30-minute 1-on-1 call. No card, no obligation." },
  { title: "Pick a course", body: "Leave the call with a plan and the course that fits it." },
  { title: "Start learning", body: "Live sessions, worked problems and the code behind them." },
];

export function HowItWorksSection() {
  return (
    <section aria-labelledby="how-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading id="how-heading" eyebrow="How it works" title="Three steps to your first session" />
        <ol data-anim="reveal" className="mt-12 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface p-6">
              <p className="font-mono text-3xl font-semibold text-quant">{i + 1}</p>
              <h3 className="mt-4 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
