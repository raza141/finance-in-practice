import { SectionHeading } from "@/core/components/ui/SectionHeading";

const POINTS = [
  {
    title: "Theory first, then the model",
    body: "Every concept is derived, drilled on exam-style problems, then implemented in Python, so you understand it rather than memorise it.",
  },
  {
    title: "1-on-1, built around you",
    body: "Sessions start from a diagnostic of where you are against the syllabus and follow a study plan made for you.",
  },
  {
    title: "Models you can trust",
    body: "Pricing, risk and portfolio examples run on our own engine, tested against published values from Hull and Bodie, Kane & Marcus.",
  },
];

export function WhyUsSection() {
  return (
    <section aria-labelledby="why-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading id="why-heading" eyebrow="Why learn with us" title="Practice-first finance teaching" />
        <ul data-anim="reveal" className="mt-12 grid gap-8 md:grid-cols-3">
          {POINTS.map((point, i) => (
            <li key={point.title}>
              <p className="font-mono text-xs text-quant">0{i + 1}</p>
              <h3 className="mt-2 text-xl font-bold">{point.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{point.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
