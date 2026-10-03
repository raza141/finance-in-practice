import { CosmicBackdrop } from "@/core/components/3d/CosmicBackdrop";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";

interface ComingSoonProps {
  eyebrow: string;
  title: string;
  description: string;
}

/** Full-viewport placeholder for routes that are announced but not yet live. */
export function ComingSoon({ eyebrow, title, description }: ComingSoonProps) {
  return (
    <section className="relative -mt-20 flex min-h-screen items-center overflow-hidden">
      <CosmicBackdrop className="absolute inset-0" tilt={1.25} />
      <div className="page-container relative py-32 text-center">
        <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">{eyebrow} · Coming soon</p>
        <h1 className="mx-auto mt-6 max-w-4xl text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-7xl">
          {title}
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted">{description}</p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <ButtonLink href={siteConfig.navCta.href} size="lg">
            {siteConfig.navCta.label}
          </ButtonLink>
          <ButtonLink href="/courses" variant="secondary" size="lg">
            Explore courses
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
