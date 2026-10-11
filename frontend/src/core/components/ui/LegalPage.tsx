import type { ReactNode } from "react";

export interface LegalSection {
  heading: string;
  body: ReactNode;
}

/** Plain reading layout shared by /privacy and /terms. */
export function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <article className="page-container max-w-3xl pt-10 pb-16 lg:pt-12">
      <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">Legal</p>
      <h1 className="mt-3 text-4xl font-bold sm:text-5xl">{title}</h1>
      <p className="mt-3 font-mono text-xs text-muted">Last updated {updated}</p>
      <div className="mt-6 text-lg leading-relaxed text-ink/85">{intro}</div>

      <div className="mt-10 space-y-10 leading-relaxed text-ink/85 [&_a]:text-quant [&_a]:underline [&_a]:underline-offset-2 [&_li]:mt-2 [&_p+p]:mt-3 [&_ul+p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {sections.map((section, i) => (
          <section key={section.heading} aria-labelledby={`legal-${i}`}>
            <h2 id={`legal-${i}`} className="text-xl font-bold text-ink sm:text-2xl">
              {i + 1}. {section.heading}
            </h2>
            <div className="mt-3">{section.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
