import Image from "next/image";

import type { Instructor } from "../types";

interface InstructorProfileProps {
  instructor: Instructor;
  index: number;
  total: number;
}

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
      className="page-container flex min-h-screen items-center py-24"
    >
      <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
        <div data-reveal className="mx-auto w-full max-w-xs sm:max-w-sm">
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
          <p data-reveal className="font-mono text-xs tracking-[0.3em] text-quant uppercase">
            Instructor {counter}
          </p>
          <h2
            data-reveal
            id={headingId}
            className="mt-4 text-4xl leading-[1.05] font-normal tracking-tight italic sm:text-6xl"
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
            <div data-reveal className="mt-6 flex gap-4 text-sm">
              {instructor.links.map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                  {link.label} ↗
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
