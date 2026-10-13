import Image from "next/image";

import type { Instructor } from "../types";

interface InstructorProfileProps {
  instructor: Instructor;
  index: number;
  total: number;
}

/** LinkedIn's "in" mark (fills its rounded square). */
const LINKEDIN_GLYPH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.65 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** One full-viewport instructor "stop" on the About page scroll journey. */
export function InstructorProfile({ instructor, index, total }: InstructorProfileProps) {
  const headingId = `${instructor.id}-name`;
  const counter = `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;

  return (
    <section
      data-cosmic-section
      aria-labelledby={headingId}
      className="page-container flex items-center py-10 lg:min-h-[80svh] lg:py-16"
    >
      <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div data-reveal className="mx-auto w-full max-w-[13rem] sm:max-w-sm">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/15 bg-surface/60 shadow-[0_0_80px_-20px_rgb(34_211_238/0.45)] backdrop-blur-sm">
            {instructor.photo ? (
              <Image
                src={instructor.photo}
                alt={`Portrait of ${instructor.name}`}
                fill
                sizes="(min-width: 1024px) 24rem, 20rem"
                // External links skip the optimizer, which only allows configured hosts.
                unoptimized={!instructor.photo.startsWith("/")}
                className="object-cover"
              />
            ) : (
              <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgb(34_211_238/0.25),transparent_65%)]">
                <span className="font-serif text-7xl font-black text-ink/90 italic">{initials(instructor.name)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-canvas/45 p-6 backdrop-blur-md sm:p-8">
          {total > 1 && (
            <p data-reveal className="mb-4 font-mono text-xs tracking-[0.3em] text-quant uppercase">
              Instructor {counter}
            </p>
          )}
          <h2
            data-reveal
            id={headingId}
            className="text-4xl leading-[1.05] font-normal tracking-tight italic sm:text-6xl"
          >
            {instructor.name}
          </h2>
          <p data-reveal className="mt-3 text-base text-muted">
            {instructor.role}
          </p>
          <p data-reveal className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/90">
            {instructor.bio}
          </p>

          <div data-reveal className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
                Education
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-ink/90">
                {instructor.education.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Background</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/90">{instructor.background}</p>
            </div>
          </div>

          <ul data-reveal className="mt-8 flex flex-wrap gap-2">
            {instructor.highlights.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-quant/30 bg-quant/5 px-3 py-1 font-mono text-xs text-quant"
              >
                {tag}
              </li>
            ))}
          </ul>

          {instructor.links && instructor.links.length > 0 && (
            <div data-reveal className="mt-8 flex flex-wrap gap-3">
              {instructor.links.map((link) =>
                link.label === "LinkedIn" ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${instructor.name} on LinkedIn`}
                    className="group inline-flex items-center gap-3 rounded-xl bg-[#0A66C2] py-2.5 pr-5 pl-2.5 text-white shadow-[0_10px_34px_-12px_rgb(10_102_194/0.9)] transition hover:-translate-y-0.5 hover:bg-[#004182] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quant"
                  >
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white">
                      <svg viewBox="0 0 24 24" width="20" height="20" fill="#0A66C2" aria-hidden>
                        <path d={LINKEDIN_GLYPH} />
                      </svg>
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-sm font-semibold">Connect on LinkedIn</span>
                      <span className="text-xs text-white/75">{link.href.replace(/^https:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
                    </span>
                  </a>
                ) : (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="self-center text-sm text-quant hover:underline">
                    {link.label} ↗
                  </a>
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
