import { HeroScene } from "@/core/components/3d/HeroScene";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";

const HEADLINE: { text: string; accent?: boolean }[][] = [
  [{ text: "Master" }, { text: "Financial" }, { text: "Theory." }],
  [{ text: "Build" }, { text: "Real-World" }, { text: "Systems.", accent: true }],
];

const STATUS = [
  { label: "System status", value: "Accepting new learners", live: true },
  { label: "Primary coverage", value: "CFA® · FRM® · Quantitative Finance" },
  { label: "Delivery model", value: "1-on-1 · Diagnostic-led · Application-focused" },
];

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div className="page-container grid items-center gap-8 pt-10 pb-14 sm:pt-16 lg:grid-cols-2 xl:gap-16 lg:pt-24 lg:pb-24">
        <div className="relative z-10">
          <p
            data-anim="hero-subtitle"
            className="font-mono text-xs tracking-[0.22em] text-quant uppercase"
          >
            CFA® Level I · FRM® · University Finance
          </p>

          <h1
            id="hero-heading"
            className="mt-5 text-[2.6rem] leading-[1.08] font-black tracking-tight sm:text-6xl lg:text-[4.1rem]"
          >
            {HEADLINE.map((line, i) => (
              <span key={i} className="block">
                {line.map((word) => (
                  <span key={word.text}>
                    <span
                      data-anim="hero-word"
                      className={`inline-block ${word.accent ? "text-quant" : ""}`}
                    >
                      {word.text}
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
            <strong className="font-semibold text-gold">1-on-1 CFA® &amp; FRM® tutoring</strong> where
            every formula makes sense: worked by hand, applied to real markets, then built in code.
          </p>

          <ul data-anim="hero-subtitle" className="mt-5 flex flex-wrap gap-2 text-sm font-medium">
            <li className="flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-3.5 py-1.5 text-ink">
              <span aria-hidden className="h-2 w-2 rounded-full bg-gold" />
              In person · Abu Dhabi
            </li>
            <li className="flex items-center gap-2 rounded-full border border-quant/40 bg-quant/10 px-3.5 py-1.5 text-ink">
              <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-quant" />
              Live online · Dubai &amp; UAE
            </li>
          </ul>

          {/* Terminal readout is flavour, not message: desktop only so the CTA stays above the fold on phones. */}
          <dl
            data-anim="hero-subtitle"
            className="mt-6 hidden gap-1.5 font-mono text-xs tracking-wide sm:grid sm:text-[13px] lg:text-[11.5px] xl:text-[13px]"
          >
            {STATUS.map((row) => (
              <div key={row.label} className="flex gap-x-2">
                <dt className="shrink-0 text-muted uppercase">{row.label}:</dt>
                <dd className={row.live ? "flex items-center gap-2 text-quant" : "text-ink/90 sm:whitespace-nowrap"}>
                  {row.live && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-quant" />}
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:mt-9 sm:flex-row">
            <span data-anim="hero-cta">
              <ButtonLink href={siteConfig.bookingHref} size="lg" className="w-full sm:w-auto">
                Book a Diagnostic Session
              </ButtonLink>
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
            <HeroScene className="mx-auto h-full w-full lg:aspect-square lg:h-auto lg:max-w-[820px]" />
          </div>
        </div>
      </div>
    </section>
  );
}
