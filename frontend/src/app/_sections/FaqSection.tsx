import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { siteConfig } from "@/core/config/site";
import { StructuredData } from "@/core/seo/StructuredData";

/** One list feeds both the page and the FAQPage markup, so they never differ. Facts only from site config and the course cards. */
export const HOME_FAQ: readonly { question: string; answer: string; link?: { href: string; label: string } }[] = [
  {
    question: "How much does CFA® or FRM® tutoring cost?",
    answer: `CFA® and FRM®: ${siteConfig.fees.exam}. University finance: ${siteConfig.fees.university}. The first 30-minute diagnostic session is free.`,
    link: { href: "/pricing", label: "See pricing" },
  },
  {
    question: "Is the first session free?",
    answer: "Yes. The diagnostic is 30 minutes and free, with no card needed. We find your gaps and map the fastest route to exam day.",
  },
  {
    question: "Do you teach at home or online?",
    answer: `${siteConfig.delivery.line} Online sessions run live on Zoom.`,
  },
  {
    question: "Which exams and courses do you cover?",
    answer: "CFA® Level I and Level II, FRM® Part I, and university finance (BSc, MSc and MBA modules, and dissertations). Also personal finance, financial modelling and Python for finance.",
    link: { href: "/courses", label: "See all courses" },
  },
  {
    question: "How many hours of study do the exams take?",
    answer: "Typical self-study is 300+ hours for CFA® Level I or Level II and about 240 hours for FRM® Part I. How many tutoring hours you need depends on your diagnostic.",
  },
  {
    question: "What do I get between sessions?",
    answer: "A student portal with a study plan built around your exam date, exam-style mocks with a countdown clock and question map, a score for every topic, and a mistakes notebook. Your tutor sees your results too.",
  },
  {
    question: "Can I test myself before booking?",
    answer: "Yes. Take the free 10-question CFA® Level I diagnostic test: one question from each topic, scored by topic, with no sign-up.",
    link: { href: "/cfa/diagnostic", label: "Take the free test" },
  },
];

/** Home FAQ: native disclosure rows (keyboard and screen readers for free), the same answers as JSON-LD. */
export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-28 border-t border-line">
      <JsonLd data={StructuredData.faq(HOME_FAQ)} />
      <div className="page-container grid gap-8 py-12 lg:grid-cols-12 lg:gap-10 lg:py-16">
        <div className="lg:col-span-4">
          <SectionHeading id="faq-heading" title="Questions, answered" />
        </div>
        <div className="divide-y divide-line border-y border-line lg:col-span-8">
          {HOME_FAQ.map((f) => (
            <details key={f.question} className="group">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 font-semibold text-ink transition-colors duration-150 hover:text-quant [&::-webkit-details-marker]:hidden">
                {f.question}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="max-w-[65ch] pb-5 leading-relaxed text-muted">
                <p>{f.answer}</p>
                {f.link && (
                  <Link href={f.link.href} className="mt-2 inline-block text-quant underline-offset-4 hover:underline">
                    {f.link.label}
                  </Link>
                )}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
