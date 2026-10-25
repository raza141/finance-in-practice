import type { ReactNode } from "react";

import { SectionHeading } from "@/core/components/ui/SectionHeading";

/** Small drawings of the real screens, with sample numbers: decoration, so hidden from screen readers. */
const SHOT = "min-h-52 overflow-hidden border-b border-line bg-canvas p-4 text-xs";

const PALETTE = Array.from({ length: 20 }, (_, i) => i + 1);
const FLAGGED = new Set([4, 9]);
const TOPICS: [string, number][] = [
  ["Ethics", 80],
  ["Fixed Income", 45],
  ["FSA", 72],
  ["Equity", 75],
  ["Derivatives", 50],
];

function MockShot() {
  return (
    <div aria-hidden className={SHOT}>
      <div className="flex items-center justify-between text-muted">
        <span>Question 14 of 90</span>
        <span className="font-mono text-sm font-semibold text-ink">1:23:45</span>
        <span className="rounded-md border border-line px-2 py-0.5">⏸ Pause</span>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1">
        {PALETTE.map((n) => (
          <span
            key={n}
            className={`grid aspect-square place-items-center rounded border font-mono text-[9px] ${
              n === 14 ? "border-quant text-ink" : FLAGGED.has(n) ? "border-gold bg-gold/25 text-gold" : n < 14 ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200" : "border-line bg-surface text-muted"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
      <p className="mt-3 text-ink/90">A bond&rsquo;s price rises from 98.40 to 99.10 when its yield falls 10 bp. Its modified duration is closest to:</p>
      <div className="mt-2 flex gap-2">
        <span className="rounded-md border border-line px-2 py-1 text-muted line-through opacity-50">A. 5.1</span>
        <span className="rounded-md border border-quant bg-quant/10 px-2 py-1">B. 7.1</span>
        <span className="rounded-md border border-line px-2 py-1 text-muted">C. 8.9</span>
      </div>
    </div>
  );
}

function TopicShot() {
  return (
    <div aria-hidden className={SHOT}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-2xl font-semibold">68%</span>
        <span className="text-muted">Mock 3 · 61 / 90</span>
      </p>
      <div className="mt-2 grid gap-2">
        {TOPICS.map(([name, pct]) => (
          <div key={name} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2">
            <span>{name}</span>
            <span className="h-2 overflow-hidden rounded bg-surface-raised">
              <span className={`block h-full rounded ${pct < 60 ? "bg-gold" : "bg-quant"}`} style={{ width: `${pct}%` }} />
            </span>
            <span className="text-right font-mono">{pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PortalShot() {
  return (
    <div aria-hidden className={SHOT}>
      <div className="flex gap-1 overflow-hidden rounded-xl border border-line p-1 whitespace-nowrap">
        <span className="rounded-lg bg-quant/15 px-2 py-1 font-semibold text-quant">Overview</span>
        <span className="px-2 py-1 text-muted">Book a session</span>
        <span className="px-2 py-1 text-muted">Progress</span>
        <span className="px-2 py-1 text-muted">Study plan</span>
      </div>
      {[
        ["Next session", "Thu 7:00 pm · Online · Fixed Income"],
        ["Study plan", "Week 6 of 14 · Derivatives next"],
        ["Latest mock", "68% · up from 55% on your first"],
      ].map(([label, value]) => (
        <div key={label} className="mt-2 rounded-xl border border-line bg-surface px-3 py-1.5">
          <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">{label}</p>
          <p>{value}</p>
        </div>
      ))}
    </div>
  );
}

const CARDS: { tag: string; title: string; shot: ReactNode; points: string[] }[] = [
  {
    tag: "Exam-style mocks",
    title: "Practise on a screen like exam day’s",
    shot: <MockShot />,
    points: [
      "Countdown clock, question map, flags, crossing out answers and your own notes",
      "Full mocks in two sessions with an optional break; tables and charts as the exam shows them",
      "Answers save as you go. Pause, and pick up where you stopped",
    ],
  },
  {
    tag: "Topic-by-topic progress",
    title: "See exactly where you lose marks",
    shot: <TopicShot />,
    points: [
      "A score for every topic after each mock, and its trend across retakes",
      "Go back over only what you got wrong, flagged or noted, with explanations",
      "Your tutor sees your results too, so the next session starts on your weakest topic",
    ],
  },
  {
    tag: "Student portal",
    title: "Your whole prep in one place",
    shot: <PortalShot />,
    points: [
      "Book or move sessions, and see every past and upcoming one",
      "A study plan built around your exam date, plus your materials",
      "Hours left and payments; add it to your phone’s home screen like an app",
    ],
  },
];

export function StudyPortalSection() {
  return (
    <section aria-labelledby="portal-heading" className="border-t border-line">
      <div className="page-container py-12 lg:py-16">
        <SectionHeading
          id="portal-heading"
          eyebrow="Your private study portal"
          title="Your prep keeps going between sessions"
          lede="Mocks that work like exam day, a score for every topic, and your sessions, plan and materials in one place. You always know what to study next."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {CARDS.map((card) => (
            <article key={card.tag} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
              {card.shot}
              <div className="p-6">
                <p className="font-mono text-[11px] tracking-[0.2em] text-gold uppercase">{card.tag}</p>
                <h3 className="mt-1.5 text-lg font-bold">{card.title}</h3>
                <ul className="mt-3 grid gap-2 text-sm text-muted">
                  {card.points.map((p) => (
                    <li key={p} className="flex gap-2.5">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-quant" />
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
