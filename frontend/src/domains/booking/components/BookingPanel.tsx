import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { TiltSurface } from "@/core/components/ui/TiltSurface";

import { QuantBookingWidget } from "./QuantBookingWidget";

const WHAT_YOU_GET = [
  "A 30-minute 1-on-1 video session, free",
  "A diagnostic of where you are against the syllabus",
  "A personalised study or project plan you keep",
  "No obligation and no card required",
];

interface BookingPanelProps {
  headingId?: string;
  /** Override the default free-demo copy, e.g. on a course page. */
  title?: string;
  lede?: string;
}

const DEFAULT_LEDE =
  "Bring a topic you are stuck on, whether a CFA reading, an FRM formula or a university assignment, and leave with a clear plan.";

export function BookingPanel({
  headingId = "book-heading",
  title = "Book your free demo session",
  lede = DEFAULT_LEDE,
}: BookingPanelProps) {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="lg:col-span-4">
        <SectionHeading
          id={headingId}
          eyebrow="Free demo session"
          title={title}
          lede={lede}
        />
        <ul className="mt-8 space-y-4" data-anim="reveal">
          {WHAT_YOU_GET.map((item) => (
            <li key={item} className="flex gap-3 text-[15px] text-ink/90">
              <span
                aria-hidden
                className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-quant/70"
              >
                <span className="h-1.5 w-1.5 rounded-[1px] bg-quant" />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div data-anim="reveal" className="lg:col-span-8">
        <TiltSurface maxTilt={2.5}>
          <QuantBookingWidget />
        </TiltSurface>
      </div>
    </div>
  );
}
