import type { Metadata } from "next";

import { InstructorProfile } from "@/domains/team/components/InstructorProfile";
import { InstructorShowcase } from "@/domains/team/components/InstructorShowcase";
import { InstructorRepository } from "@/domains/team/server/InstructorRepository";

// Instructors come from the database. Admin saves revalidate "/about"
// immediately; this hourly ISR is a fallback.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "About Us",
  description: "Meet the instructors behind Finance in Practice: practitioners who teach the theory and build the models.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const instructors = await InstructorRepository.published();

  return (
    <InstructorShowcase count={instructors.length}>
      <section
        data-cosmic-section
        aria-labelledby="about-heading"
        className="page-container flex min-h-screen flex-col items-center justify-center py-32 text-center"
      >
        <p data-reveal className="font-mono text-xs tracking-[0.3em] text-quant uppercase">
          About us · The instructors
        </p>
        <h1
          data-reveal
          id="about-heading"
          className="mt-6 max-w-4xl text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-7xl"
        >
          Learn from someone who works at the intersection of finance, risk and technology
        </h1>
        <p data-reveal className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          Theory first, then the model that proves it. Scroll to meet each of us.
        </p>
        <p data-reveal className="mt-16 font-mono text-[11px] tracking-[0.35em] text-muted uppercase">
          Scroll ↓
        </p>
      </section>

      {instructors.map((instructor, i) => (
        <InstructorProfile key={instructor.id} instructor={instructor} index={i} total={instructors.length} />
      ))}
    </InstructorShowcase>
  );
}
