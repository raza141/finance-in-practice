import { SectionHeading } from "@/core/components/ui/SectionHeading";

import { BookingDesk } from "./BookingDesk";

interface BookingPanelProps {
  headingId?: string;
  eyebrow?: string;
  /** Override the default free-diagnostic copy, e.g. on a course page. */
  title?: string;
  lede?: string;
}

export function BookingPanel({
  headingId = "book-heading",
  eyebrow,
  title = "Book your free diagnostic session",
  lede,
}: BookingPanelProps) {
  return <BookingDesk heading={<SectionHeading id={headingId} eyebrow={eyebrow} title={title} lede={lede} />} />;
}
