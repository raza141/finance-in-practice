import Image from "next/image";

import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { InstructorRepository } from "@/domains/team/server/InstructorRepository";

export async function AboutTeaserSection() {
  const [founder] = await InstructorRepository.published();
  if (!founder) return null;
  const initials = founder.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");

  return (
    <section aria-labelledby="about-teaser-heading" data-sequence="reveal" className="border-t border-line">
      <div data-anim="reveal" className="page-container grid items-center gap-10 py-20 md:grid-cols-[14rem_1fr] lg:py-24">
        <div className="relative mx-auto aspect-[4/5] w-56 overflow-hidden rounded-[2rem] border border-white/15 bg-surface/60">
          {founder.photo ? (
            <Image src={founder.photo} alt={`Portrait of ${founder.name}`} fill sizes="14rem" unoptimized={!founder.photo.startsWith("/")} className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238/0.25),transparent_65%)]">
              <span className="font-serif text-6xl font-black text-ink/90 italic">{initials}</span>
            </div>
          )}
        </div>
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">Your instructor</p>
          <h2 id="about-teaser-heading" className="mt-3 text-3xl font-bold sm:text-4xl">
            {founder.name}
          </h2>
          <p className="mt-1 text-sm text-muted">{founder.role}</p>
          {founder.education.length > 0 && (
            <ul aria-label="Credentials" className="mt-5 flex flex-wrap gap-2">
              {founder.education.map((item) => (
                <li key={item} className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-sm font-semibold text-ink">
                  <span aria-hidden className="text-gold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
          {/* Bio only: the engineering background lives on /about, the teaser sells the teacher. */}
          <p className="mt-5 text-lg leading-relaxed text-ink/90">{founder.bio}</p>
          <ButtonLink href="/about" variant="secondary" className="mt-8">
            Meet your instructor
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
