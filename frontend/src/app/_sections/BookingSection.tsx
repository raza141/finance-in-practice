import { BookingPanel } from "@/domains/booking/components/BookingPanel";

export function BookingSection() {
  return (
    <section
      id="book"
      aria-labelledby="book-heading"
      data-sequence="reveal"
      className="border-t border-line bg-gradient-to-b from-surface/40 to-transparent"
    >
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
        <BookingPanel headingId="book-heading" />
      </div>
    </section>
  );
}
