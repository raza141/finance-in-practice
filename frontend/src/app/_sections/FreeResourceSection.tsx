import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { FreeResourceBlock } from "@/domains/resources/components/FreeResourceBlock";
import { ResourceCatalog } from "@/domains/resources/services/ResourceCatalog";

/** Last stop for visitors not ready to book: trade an email for the exam map, and stay in touch. */
export function FreeResourceSection() {
  const [resource] = ResourceCatalog.FREE;
  if (!resource) return null;
  return (
    <section id="free-guide" aria-labelledby="free-guide-heading" data-sequence="reveal" className="border-t border-line">
      <div className="page-container py-20 lg:py-24">
        <SectionHeading id="free-guide-heading" eyebrow="Not ready to book yet?" title="Start with the free exam map" />
        <div data-anim="reveal" className="mt-10">
          <FreeResourceBlock resource={resource} source="home" />
        </div>
      </div>
    </section>
  );
}
