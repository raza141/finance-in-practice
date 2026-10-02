import { LandingAnimator } from "@/core/animations/LandingAnimator";

import { BentoSection } from "./_sections/BentoSection";
import { BookingSection } from "./_sections/BookingSection";
import { HeroSection } from "./_sections/HeroSection";
import { QuantLabMetrics } from "./_sections/QuantLabMetrics";
import { TestimonialsSection } from "./_sections/TestimonialsSection";

export default function HomePage() {
  return (
    <LandingAnimator>
      <HeroSection />
      <BentoSection />
      <QuantLabMetrics />
      <TestimonialsSection />
      <BookingSection />
    </LandingAnimator>
  );
}
