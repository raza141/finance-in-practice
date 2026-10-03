import { HeroScene } from "@/core/components/3d/HeroScene";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";

const HEADLINE: { text: string; accent?: boolean }[][] = [
  [{ text: "Master" }, { text: "Financial" }, { text: "Theory." }],
  [{ text: "Build" }, { text: "Real-World" }, { text: "Systems.", accent: true }],
];

export function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden">
      <div className="page-container grid items-center gap-8 pt-12 pb-16 sm:pt-16 lg:grid-cols-2 xl:gap-16 lg:pt-24 lg:pb-24">
        <div>
          <p
            data-anim="hero-subtitle"
            className="font-mono text-xs tracking-[0.22em] text-quant uppercase"
          >
            CFA® · FRM® · University Finance
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
            className="mt-6 max-w-xl text-lg leading-relaxed text-muted"
          >
            1-on-1 tutoring for CFA Level I–II, FRM Part I and university finance, from a
            practitioner who builds the models. Learn what the examiners test, then implement
            it in Python.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <span data-anim="hero-cta">
              <ButtonLink href={siteConfig.bookingHref} size="lg" className="w-full sm:w-auto">
                Book a Free Demo
              </ButtonLink>
            </span>
            <span data-anim="hero-cta">
              <ButtonLink
                href="/courses"
                variant="secondary"
                size="lg"
                className="w-full sm:w-auto"
              >
                Explore Curriculum
              </ButtonLink>
            </span>
          </div>
        </div>

        <div data-anim="hero-canvas" className="relative">
          <HeroScene className="mx-auto aspect-square w-full max-w-[820px]" />
        </div>
      </div>
    </section>
  );
}
