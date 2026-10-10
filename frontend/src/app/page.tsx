import type { Metadata } from "next";

import { LandingAnimator } from "@/core/animations/LandingAnimator";

import { AboutTeaserSection } from "./_sections/AboutTeaserSection";
import { BookingSection } from "./_sections/BookingSection";
import { FeaturedCoursesSection } from "./_sections/FeaturedCoursesSection";
import { FreeResourceSection } from "./_sections/FreeResourceSection";
import { HeroSection } from "./_sections/HeroSection";
import { HowItWorksSection } from "./_sections/HowItWorksSection";
import { TestimonialsSection } from "./_sections/TestimonialsSection";
import { WhyUsSection } from "./_sections/WhyUsSection";

// Approved testimonials come from the database. Moderation actions revalidate
// "/" immediately; this hourly ISR is a fallback.
export const revalidate = 3600;

export const metadata: Metadata = { alternates: { canonical: "/" } };

/** One goal: book a diagnostic session. Order: offer → method → who teaches → proof → steps → booking,
 * then a free download for visitors not ready to book. */
export default function HomePage() {
  return (
    <LandingAnimator>
      <HeroSection />
      <FeaturedCoursesSection />
      <WhyUsSection />
      <AboutTeaserSection />
      <TestimonialsSection />
      <HowItWorksSection />
      <BookingSection />
      <FreeResourceSection />
    </LandingAnimator>
  );
}
