import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";

import { CourseFormat } from "../services/CourseFormat";
import type { Course } from "../types";

/** Key facts plus the two actions: book a call (Cal.com) and download the brochure. */
export function CourseEnrolCard({ course }: { course: Course }) {
  const facts = [
    { label: "Next start", value: CourseFormat.startDate(course.startDate) },
    { label: "Duration", value: course.duration },
    { label: "Programme fee", value: CourseFormat.price(course) },
  ];

  return (
    <aside aria-label="Course details" className="rounded-xl border border-line bg-surface p-6">
      <dl className="divide-y divide-line">
        {facts.map((fact) => (
          <div key={fact.label} className="flex items-baseline justify-between gap-6 py-3 first:pt-0">
            <dt className="font-mono text-xs tracking-[0.16em] text-muted uppercase">{fact.label}</dt>
            <dd className="text-right font-semibold">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-3">
        <ButtonLink href={siteConfig.contact.calUrl} target="_blank" rel="noopener noreferrer" size="lg">
          Book a call about this course
        </ButtonLink>
        {course.brochureUrl && (
          <ButtonLink
            href={course.brochureUrl}
            variant="secondary"
            size="lg"
            target="_blank"
            rel="noopener noreferrer"
            download
            prefetch={false}
          >
            Download brochure
            <span aria-hidden className="font-mono text-xs opacity-70">
              PDF
            </span>
          </ButtonLink>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Free 30-minute call to check fit, schedule and prerequisites. No obligation.
      </p>
    </aside>
  );
}
