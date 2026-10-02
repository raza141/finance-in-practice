import { LandingAnimator } from "@/core/animations/LandingAnimator";

import { BookingSection } from "./_sections/BookingSection";
import { CredentialsBar } from "./_sections/CredentialsBar";
import { HeroSection } from "./_sections/HeroSection";
import { PillarsSection } from "./_sections/PillarsSection";
import { QuantLabMetrics } from "./_sections/QuantLabMetrics";

export default function HomePage() {
  return (
    <LandingAnimator>
      <HeroSection />
      <CredentialsBar />
      <PillarsSection />
      <QuantLabMetrics />
      <BookingSection />
    </LandingAnimator>
  );
}
