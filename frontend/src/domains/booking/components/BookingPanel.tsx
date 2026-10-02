import { SectionHeading } from "@/core/components/ui/SectionHeading";

import { QuantBookingWidget } from "./QuantBookingWidget";

const WHAT_YOU_GET = [
  "A 30-minute 1-on-1 video session, free",
  "A diagnostic of where you are against the syllabus",
  "A personalised study or project plan you keep",
  "No obligation and no card required",
];

export function BookingPanel({ headingId = "book-heading" }: { headingId?: string }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
      <div>
        <SectionHeading
          id={headingId}
          eyebrow="Free demo session"
          title="Book your free demo session"
          lede="Bring a topic you are stuck on, whether a CFA reading, an FRM formula or a university assignment, and leave with a clear plan."
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

      <div data-anim="reveal">
        <QuantBookingWidget />
      </div>
    </div>
  );
}
