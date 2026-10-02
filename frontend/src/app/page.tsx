import { LandingAnimator } from "@/core/animations/LandingAnimator";

import { BentoSection } from "./_sections/BentoSection";
import { BookingSection } from "./_sections/BookingSection";
import { CredentialsBar } from "./_sections/CredentialsBar";
import { HeroSection } from "./_sections/HeroSection";
import { QuantLabMetrics } from "./_sections/QuantLabMetrics";

export default function HomePage() {
  return (
    <LandingAnimator>
      <HeroSection />
      <CredentialsBar />
      <BentoSection />
      <QuantLabMetrics />
      <BookingSection />
    </LandingAnimator>
  );
}
