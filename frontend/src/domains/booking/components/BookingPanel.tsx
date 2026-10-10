import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { TiltSurface } from "@/core/components/ui/TiltSurface";

import { QuantBookingWidget } from "./QuantBookingWidget";

const WHAT_YOU_GET = [
  { label: "Duration", value: "30 minutes, 1-on-1" },
  { label: "You leave with", value: "A clear study plan" },
  { label: "Cost", value: "Free, no card needed" },
];

interface BookingPanelProps {
  headingId?: string;
  eyebrow?: string;
  /** Override the default free-demo copy, e.g. on a course page. */
  title?: string;
  lede?: string;
}

const DEFAULT_LEDE =
  "Find your starting point and leave with a plan to exam day.";

export function BookingPanel({
  headingId = "book-heading",
  eyebrow = "Free demo session",
  title = "Book your free demo session",
  lede = DEFAULT_LEDE,
}: BookingPanelProps) {
  return (
    <div className="grid gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="min-w-0 lg:col-span-4">
        <SectionHeading
          id={headingId}
          eyebrow={eyebrow}
          title={title}
          lede={lede}
        />
        <ul className="mt-8 space-y-4" data-anim="reveal">
          {WHAT_YOU_GET.map((item) => (
            <li key={item.label} className="flex gap-3 text-[15px] text-ink/90">
              <span
                aria-hidden
                className="mt-1.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border border-quant/70"
              >
                <span className="h-1.5 w-1.5 rounded-[1px] bg-quant" />
              </span>
              <span>
                <span className="block font-mono text-xs tracking-wide text-muted uppercase">{item.label}</span>
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div data-anim="reveal" className="min-w-0 lg:col-span-8">
        <TiltSurface maxTilt={2.5}>
          <QuantBookingWidget />
        </TiltSurface>
      </div>
    </div>
  );
}
