import type { Metadata } from "next";

import { LandingAnimator } from "@/core/animations/LandingAnimator";

import { AboutTeaserSection } from "./_sections/AboutTeaserSection";
import { BookingSection } from "./_sections/BookingSection";
import { FeaturedCoursesSection } from "./_sections/FeaturedCoursesSection";
import { FreeResourceSection } from "./_sections/FreeResourceSection";
import { HeroSection } from "./_sections/HeroSection";
import { HowItWorksSection } from "./_sections/HowItWorksSection";
import { StudyPortalSection } from "./_sections/StudyPortalSection";
import { WhyUsSection } from "./_sections/WhyUsSection";

// Instructors come from the database and the Google rating from Places API;
// admin saves revalidate "/" immediately, this hourly ISR is a fallback.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: { absolute: "CFA® & FRM® Classes & Coaching in Abu Dhabi | Finance in Practice" },
  description:
    "Instructor-led 1-on-1 CFA® Level I & II, FRM® Part I and university finance classes in Abu Dhabi or live online across the UAE. CBT mocks, AED 150/hour. Free 30-min diagnostic.",
  alternates: { canonical: "/" },
};

/** One goal: book a diagnostic session. Order: offer → method → portal → who teaches (+ Google reviews) → steps → booking,
 * then a free download for visitors not ready to book. */
export default function HomePage() {
  return (
    <LandingAnimator>
      <HeroSection />
      <FeaturedCoursesSection />
      <WhyUsSection />
      <StudyPortalSection />
      <AboutTeaserSection />
      <HowItWorksSection />
      <BookingSection />
      <FreeResourceSection />
    </LandingAnimator>
  );
}
