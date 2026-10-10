import { SectionHeading } from "@/core/components/ui/SectionHeading";

import { BookingDesk } from "./BookingDesk";

interface BookingPanelProps {
  headingId?: string;
  eyebrow?: string;
  /** Override the default free-diagnostic copy, e.g. on a course page. */
  title?: string;
  lede?: string;
}

const DEFAULT_LEDE = "Find your starting point and leave with a plan to exam day.";

export function BookingPanel({
  headingId = "book-heading",
  eyebrow = "Free diagnostic session",
  title = "Book your free diagnostic session",
  lede = DEFAULT_LEDE,
}: BookingPanelProps) {
  return <BookingDesk heading={<SectionHeading id={headingId} eyebrow={eyebrow} title={title} lede={lede} />} />;
}
