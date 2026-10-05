import Link from "next/link";

import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";

// ponytail: specialist links point at /courses anchors until those courses have their own pages.
const PRIMARY = [
  {
    title: "CFA®",
    level: "Level I–II",
    outcome: "Structured exam preparation where every quantitative reading is taught through worked problems and working code.",
    points: ["Personal study plan", "Exam-style problem drills", "Formula intuition, not rote"],
    /** Opens the first published course in this category; until there is one, the fallback href. */
    category: "CFA",
    href: "/courses#exam-prep",
  },
  {
    title: "FRM®",
    level: "Part I",
    outcome: "Risk models, derivatives and quantitative methods built up from first principles, then tested on exam-style questions.",
    points: ["VaR and stress testing in depth", "Exam-style problem drills", "Every formula worked, then coded"],
    category: "FRM",
    href: "/courses#exam-prep",
  },
];

const SPECIALIST = [
  { label: "AI in Finance", href: "/courses#portfolio-ml" },
  { label: "Financial Modeling", href: "/courses#financial-modeling" },
  { label: "IPS & CME", href: "/courses#ips-cme" },
  { label: "Stress Testing & VaR", href: "/courses#stress-testing" },
  { label: "Python Automation", href: "/courses#automation" },
  { label: "Goal-Based Wealth", href: "/courses#goal-based-wealth" },
];

/** Category -> slug of its first published course (by title, so Level I before Level II); empty if the database is unreachable. */
async function liveCourses(): Promise<Map<string, string>> {
  try {
    const courses = ((await CourseRepository.fromEnv()?.active()) ?? []).toSorted((a, b) => a.title.localeCompare(b.title));
    const byCategory = new Map<string, string>();
    for (const course of courses) if (!byCategory.has(course.category)) byCategory.set(course.category, course.slug);
    return byCategory;
  } catch (error) {
    console.error("home: could not load courses", error);
    return new Map();
  }
}

export async function FeaturedCoursesSection() {
  const live = await liveCourses();
  return (
    <section aria-labelledby="featured-heading" data-sequence="reveal" className="page-container py-20 lg:py-24">
      <SectionHeading id="featured-heading" eyebrow="Learning tracks" title="Pick where you want to start" />

      <div data-anim="reveal" className="mt-12 grid gap-4 lg:grid-cols-2">
        {PRIMARY.map((course) => (
          <Link
            key={course.title}
            href={live.has(course.category) ? `/courses/${live.get(course.category)}` : course.href}
            className="group flex flex-col rounded-2xl border border-gold/30 bg-[#151E32] p-7 transition-colors hover:border-gold/70 sm:p-9"
          >
            <p className="font-mono text-xs tracking-[0.2em] text-gold uppercase">Primary track · {course.level}</p>
            <h3 className="mt-4 text-4xl font-black sm:text-5xl">{course.title}</h3>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">{course.outcome}</p>
            <ul className="mt-6 space-y-2">
              {course.points.map((point) => (
                <li key={point} className="flex gap-3 text-[15px] text-ink/90">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                  {point}
                </li>
              ))}
            </ul>
            <span className="mt-8 font-semibold group-hover:text-gold">
              Learn more <span aria-hidden>→</span>
            </span>
          </Link>
        ))}
      </div>

      <div data-anim="reveal" className="mt-4 grid gap-4 md:grid-cols-2">
        <Link
          href="/courses#university"
          className="group flex flex-col rounded-2xl border border-white/5 bg-[#151E32] p-6 transition-colors hover:border-quant/30"
        >
          <p className="font-mono text-xs tracking-[0.18em] text-quant uppercase">Secondary track</p>
          <h3 className="mt-3 text-xl font-bold">University Finance Mentorship</h3>
          <p className="mt-3 flex-1 text-[15px] leading-relaxed text-muted">
            1-on-1 support for corporate finance, investments and econometrics coursework, dissertations and interviews.
          </p>
          <span className="mt-6 text-sm font-semibold group-hover:text-quant">
            Learn more <span aria-hidden>→</span>
          </span>
        </Link>

        <div className="flex flex-col rounded-2xl border border-white/5 bg-[#151E32] p-6">
          <p className="font-mono text-xs tracking-[0.18em] text-quant uppercase">Specialist tracks</p>
          <h3 className="mt-3 text-xl font-bold">Applied finance electives</h3>
          <ul className="mt-4 flex flex-1 flex-wrap content-start gap-2">
            {SPECIALIST.map((track) => (
              <li key={track.label}>
                <Link
                  href={track.href}
                  className="inline-block rounded-md border border-line px-3 py-1.5 font-mono text-xs text-ink/90 transition-colors hover:border-quant/50 hover:text-quant"
                >
                  {track.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/courses" className="mt-6 text-sm font-semibold hover:text-quant">
            All learning tracks <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
