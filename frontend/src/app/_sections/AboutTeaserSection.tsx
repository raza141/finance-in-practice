import Image from "next/image";

import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { InstructorCatalog } from "@/domains/team/services/InstructorCatalog";

export function AboutTeaserSection() {
  const [founder] = new InstructorCatalog().all();
  const initials = founder.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");

  return (
    <section aria-labelledby="about-teaser-heading" data-sequence="reveal" className="border-t border-line">
      <div data-anim="reveal" className="page-container grid items-center gap-10 py-20 md:grid-cols-[14rem_1fr] lg:py-24">
        <div className="relative mx-auto aspect-[4/5] w-56 overflow-hidden rounded-[2rem] border border-white/15 bg-surface/60">
          {founder.photo ? (
            <Image src={founder.photo} alt={`Portrait of ${founder.name}`} fill sizes="14rem" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238/0.25),transparent_65%)]">
              <span className="font-serif text-6xl font-black text-ink/90 italic">{initials}</span>
            </div>
          )}
        </div>
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">About us</p>
          <h2 id="about-teaser-heading" className="mt-3 text-3xl font-bold sm:text-4xl">
            {founder.name}
          </h2>
          <p className="mt-1 text-sm text-muted">{founder.role}</p>
          <p className="mt-5 text-lg leading-relaxed text-ink/90">
            {founder.bio} {founder.background}
          </p>
          <ButtonLink href="/about" variant="secondary" className="mt-8">
            Meet your instructor
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
