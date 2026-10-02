import type { Metadata } from "next";

import { InstructorProfile } from "@/domains/team/components/InstructorProfile";
import { InstructorShowcase } from "@/domains/team/components/InstructorShowcase";
import { InstructorCatalog } from "@/domains/team/services/InstructorCatalog";

export const metadata: Metadata = {
  title: "About Us",
  description: "Meet the instructors behind Finance in Practice: practitioners who teach the theory and build the models.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  const instructors = new InstructorCatalog().all();

  return (
    <InstructorShowcase count={instructors.length}>
      <section
        data-instructor
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
          Three practitioners, one way of teaching
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
