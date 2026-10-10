import { BookingPanel } from "@/domains/booking/components/BookingPanel";

export function BookingSection() {
  return (
    <section
      id="book"
      aria-labelledby="book-heading"
      data-sequence="reveal"
      className="border-t border-line bg-gradient-to-b from-surface/40 to-transparent"
    >
      <div className="page-container py-20 lg:py-28">
        <BookingPanel headingId="book-heading" />
      </div>
    </section>
  );
}
