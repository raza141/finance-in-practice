import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { BentoCard } from "@/domains/education/components/BentoCard";
import { ServiceCatalog } from "@/domains/education/services/ServiceCatalog";

export function BentoSection() {
  const services = new ServiceCatalog().all();
  return (
    <section
      id="curriculum"
      aria-labelledby="curriculum-heading"
      data-sequence="reveal"
      className="page-container py-20 lg:py-28"
    >
      <SectionHeading
        id="curriculum-heading"
        eyebrow="Courses & services"
        title="From exam technique to production code"
        lede="Exam preparation, university mentorship and hands-on quantitative engineering, under one roof."
      />
      <div data-sequence="bento" className="mt-12 grid gap-4 lg:grid-cols-12">
        {services.map((service) => (
          <BentoCard key={service.id} service={service} />
        ))}
      </div>
    </section>
  );
}
