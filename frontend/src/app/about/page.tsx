import type { Metadata } from "next";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { StructuredData } from "@/core/seo/StructuredData";
import { InstructorProfile } from "@/domains/team/components/InstructorProfile";
import { InstructorShowcase } from "@/domains/team/components/InstructorShowcase";
import { InstructorRepository } from "@/domains/team/server/InstructorRepository";

// Instructors come from the database. Admin saves revalidate "/about"
// immediately; this hourly ISR is a fallback.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Your Instructor",
  description:
    "Meet your CFA® and FRM® instructor in Abu Dhabi: theory first, then the model that proves it. 1-on-1 in person or online.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const instructors = await InstructorRepository.published();

  return (
    <>
      <JsonLd data={StructuredData.instructors(instructors)} />
      <InstructorShowcase count={instructors.length}>
        <section
          data-cosmic-section
          aria-labelledby="about-heading"
          className="page-container flex flex-col items-center pt-28 pb-12 text-center lg:pt-32 lg:pb-16"
        >
          <h1
            data-reveal
            id="about-heading"
            className="max-w-4xl text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-7xl"
          >
            Learn finance from someone who builds the models
          </h1>
        </section>

        {instructors.map((instructor, i) => (
          <InstructorProfile
            key={instructor.id}
            instructor={instructor}
            index={i}
            total={instructors.length}
          />
        ))}
      </InstructorShowcase>
    </>
  );
}
