import { HeroScene } from "@/core/components/3d/HeroScene";
import { BookButton } from "@/core/components/ui/BookButton";
import { ButtonLink } from "@/core/components/ui/ButtonLink";

const HEADLINE: { text: string; accent?: boolean }[][] = [
  [{ text: "CFA®" }, { text: "&" }, { text: "FRM®" }, { text: "Tutoring" }],
  [{ text: "in" }, { text: "Abu", accent: true }, { text: "Dhabi", accent: true }, { text: "& Online" }],
];

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div className="page-container grid items-center gap-8 pt-8 pb-8 sm:pt-10 lg:grid-cols-2 xl:gap-16 lg:pt-6 lg:pb-8">
        <div className="@container relative z-10">
          <p
            data-anim="hero-subtitle"
            className="font-mono text-xs tracking-[0.22em] text-quant uppercase"
          >
            CFA® Level I · FRM® · University Finance
          </p>

          <h1
            id="hero-heading"
            // Two lines at every width: each line is ~10.7em wide, so 9% of the column (cqw) always fits; capped at the old size.
            className="mt-5 text-[min(9cqw,4.1rem)] leading-[1.08] font-black tracking-tight"
          >
            {HEADLINE.map((line, i) => (
              <span key={i} className="block whitespace-nowrap">
                {line.map((word) => (
                  <span key={word.text}>
                    <span
                      data-anim="hero-word"
                      className={`inline-block ${word.accent ? "text-quant" : ""}`}
                    >
                      {word.text.endsWith("®") ? (
                        <>
                          {word.text.slice(0, -1)}
                          <sup className="text-[0.4em]">®</sup>
                        </>
                      ) : (
                        word.text
                      )}
                    </span>{" "}
                  </span>
                ))}
              </span>
            ))}
          </h1>

          <p
            data-anim="hero-subtitle"
            className="mt-6 max-w-xl text-lg leading-relaxed text-ink/85 sm:text-xl"
          >
            <strong className="font-semibold text-gold">1-on-1 exam prep</strong> that starts with a free diagnostic:
            every formula from first principles, tied to real markets, on a plan built around your exam date.
          </p>

          <ul data-anim="hero-subtitle" className="mt-5 flex flex-wrap gap-2 text-sm font-medium">
            <li className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-ink">
              <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />
              At your home · Abu Dhabi
            </li>
            <li className="flex items-center gap-2 rounded-full border border-quant/40 bg-quant/10 px-3.5 py-1.5 text-ink">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-quant" />
              Live online · Dubai &amp; UAE
            </li>
          </ul>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <span data-anim="hero-cta">
              <BookButton size="lg" className="w-full sm:w-auto" />
            </span>
            <span data-anim="hero-cta">
              <ButtonLink
                href="/courses"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                See courses
              </ButtonLink>
            </span>
          </div>
          <p data-anim="hero-cta" className="mt-3 font-mono text-xs tracking-wide text-muted">
            Free · 30 min · no card needed
          </p>
        </div>

        {/* Phones: the surface sits faded behind the headline instead of a square block below the CTA. */}
        <div
          data-anim="hero-canvas"
          className="pointer-events-none absolute inset-x-0 top-10 h-[60vh] max-h-[520px] lg:pointer-events-auto lg:relative lg:inset-auto lg:h-auto lg:max-h-none"
        >
          <div className="h-full opacity-35 lg:opacity-100">
            <HeroScene className="mx-auto h-full w-full lg:aspect-square lg:h-auto lg:max-w-[460px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
