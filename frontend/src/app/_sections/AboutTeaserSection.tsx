import Image from "next/image";

import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { InstructorRepository } from "@/domains/team/server/InstructorRepository";
import { GoogleReviewButtons } from "@/domains/testimonials/components/GoogleReviews";

export async function AboutTeaserSection() {
  const [founder] = await InstructorRepository.published();
  if (!founder) return null;
  const initials = founder.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("");

  return (
    <section aria-labelledby="about-teaser-heading" className="border-t border-line">
      <div className="page-container grid items-center gap-10 py-12 md:grid-cols-[18rem_1fr] lg:grid-cols-[24rem_1fr] lg:gap-16 lg:py-16">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-80 overflow-hidden rounded-[2rem] border border-white/15 bg-surface/60 shadow-[0_0_80px_-20px_rgb(34_211_238/0.45)] md:max-w-none">
          {founder.photo ? (
            <Image src={founder.photo} alt={`Portrait of ${founder.name}`} fill sizes="(min-width: 1024px) 24rem, 20rem" unoptimized={!founder.photo.startsWith("/")} className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238/0.25),transparent_65%)]">
              <span className="font-serif text-7xl font-black text-ink/90 italic">{initials}</span>
            </div>
          )}
        </div>
        <div className="min-w-0 max-w-2xl">
          <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">Your instructor</p>
          <h2 id="about-teaser-heading" className="mt-3 text-3xl font-bold sm:text-4xl">
            {founder.name}
          </h2>
          <p className="mt-1 text-sm text-muted">{founder.role}</p>
          {founder.education.length > 0 && (
            // One line at every width: chips shrink on phones and scroll sideways rather than wrap.
            <ul aria-label="Credentials" className="-mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:gap-2">
              {founder.education.map((item) => (
                <li key={item} className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-ink sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-sm">
                  <span aria-hidden className="text-gold">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 text-lg leading-relaxed text-ink/90">{founder.bio}</p>
          {(founder.background || founder.highlights.length > 0) && (
            <div className="mt-6 rounded-2xl border border-line bg-surface/70 p-5 sm:p-6">
              <h3 className="text-sm font-semibold text-gold">Background</h3>
              {founder.background && <p className="mt-2 leading-relaxed text-ink/90">{founder.background}</p>}
              {founder.highlights.length > 0 && (
                <ul aria-label="Specialisms" className="mt-4 flex flex-wrap gap-2">
                  {founder.highlights.map((tag) => (
                    <li key={tag} className="rounded-full border border-quant/30 bg-quant/5 px-3 py-1 text-xs font-medium text-quant">
                      {tag}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <ButtonLink href="/about" variant="secondary" className="mt-8">
            Meet your instructor
          </ButtonLink>
          {/* Social proof lives on Google; the on-site testimonials (/admin/testimonials) are kept but not shown. */}
          <GoogleReviewButtons className="mt-6" />
        </div>
      </div>
    </section>
  );
}
