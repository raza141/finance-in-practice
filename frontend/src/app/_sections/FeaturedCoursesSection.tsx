import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";

// ponytail: links point at /courses anchors until each course has its own page.
const FEATURED = [
  { title: "CFA®", outcome: "Level I–II prep with a personal study plan and exam-style drills.", href: "/courses#exam-prep" },
  { title: "FRM®", outcome: "Part I prep where every quantitative topic is worked, then coded.", href: "/courses#exam-prep" },
  { title: "Python for Finance", outcome: "Replace fragile spreadsheets with tested Python pipelines.", href: "/courses#automation" },
  { title: "Financial Modeling", outcome: "Valuation, bond and option models checked against textbook values.", href: "/courses#financial-modeling" },
];

export function FeaturedCoursesSection() {
  return (
    <section aria-labelledby="featured-heading" data-sequence="reveal" className="page-container py-20 lg:py-24">
      <SectionHeading id="featured-heading" eyebrow="Courses" title="Pick where you want to start" />
      <ul data-anim="reveal" className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED.map((course) => (
          <li key={course.title}>
            <Link
              href={course.href}
              className="group flex h-full flex-col rounded-2xl border border-white/5 bg-[#151E32] p-6 transition-colors hover:border-quant/30"
            >
              <h3 className="text-xl font-bold">{course.title}</h3>
              <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">{course.outcome}</p>
              <span className="mt-6 text-sm font-semibold group-hover:text-quant">
                Learn more <span aria-hidden>→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p data-anim="reveal" className="mt-8">
        <Link href="/courses" className="font-mono text-sm text-quant hover:text-ink">
          See all courses →
        </Link>
      </p>
    </section>
  );
}
