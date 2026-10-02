import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { TrackCard } from "@/domains/education/components/TrackCard";
import { CurriculumCatalog } from "@/domains/education/services/CurriculumCatalog";

export function PillarsSection() {
  const pillars = new CurriculumCatalog().all();
  return (
    <section
      id="curriculum"
      aria-labelledby="curriculum-heading"
      data-sequence="reveal"
      className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28"
    >
      <SectionHeading
        id="curriculum-heading"
        eyebrow="Curriculum"
        title="Four ways to learn finance properly"
        lede="From exam technique to production code: pick the track that matches where you are now."
      />
      <div
        data-sequence="services"
        className="perspective-stage mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
      >
        {pillars.map((pillar) => (
          <TrackCard key={pillar.id} pillar={pillar} />
        ))}
      </div>
    </section>
  );
}
