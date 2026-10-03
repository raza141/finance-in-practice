import { LandingAnimator } from "@/core/animations/LandingAnimator";

import { BookingSection } from "./_sections/BookingSection";
import { HeroSection } from "./_sections/HeroSection";
import { QuantLabMetrics } from "./_sections/QuantLabMetrics";
import { TestimonialsSection } from "./_sections/TestimonialsSection";

// Approved testimonials come from the database. Moderation actions revalidate
// "/" immediately; this hourly ISR is a fallback.
export const revalidate = 3600;

export default function HomePage() {
  return (
    <LandingAnimator>
      <HeroSection />
      <QuantLabMetrics />
      <TestimonialsSection />
      <BookingSection />
    </LandingAnimator>
  );
}
