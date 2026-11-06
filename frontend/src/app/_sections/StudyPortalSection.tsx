import { CalendarDays, ChartLine, Check, ChevronRight, GraduationCap, type LucideIcon, Pause } from "lucide-react";
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
        <span className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-0.5">
          <Pause aria-hidden className="size-3" /> Pause
        </span>
      </div>
      <div className="mt-3 grid grid-cols-10 gap-1">
        {PALETTE.map((n) => (
          <span
            key={n}
            className={`grid aspect-square place-items-center rounded border font-mono text-[9px] ${
              n === 14 ? "border-quant text-ink" : FLAGGED.has(n) ? "border-gold bg-surface-raised text-gold" : n < 14 ? "border-emerald-400/70 bg-emerald-400/20 text-emerald-200" : "border-line bg-surface text-muted"
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
  const rows: [LucideIcon, string, string, boolean][] = [
    [CalendarDays, "Fixed Income: yield measures", "Study plan · by Thu 12 Nov", false],
    [GraduationCap, "Ethics problem set 2", "Missing · CFA Level I", true],
    [ChartLine, "Latest mock · 68%", "+13 pts since your first", false],
  ];
  return (
    <div aria-hidden className={SHOT}>
      <p className="font-serif text-base italic">Good evening, Sara</p>
      <div className="mt-2 flex items-center gap-3 rounded-xl border border-line bg-surface p-2.5">
        <span className="grid w-9 shrink-0 overflow-hidden rounded-lg border border-line text-center">
          <span className="bg-surface-raised font-mono text-[8px] font-semibold tracking-widest text-quant">NOV</span>
          <span className="text-sm font-semibold">12</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">Thursday, 19:00–20:00</span>
          <span className="block text-muted">CFA® Level I · Online · Zoom</span>
        </span>
        <span className="rounded-md bg-quant px-2 py-1 font-mono text-[10px] font-semibold text-canvas">Join</span>
      </div>
      <div className="mt-2 grid">
        {rows.map(([Icon, title, detail, urgent]) => (
          <div key={title} className="flex items-center gap-2.5 px-1 py-1.5">
            <span className={`grid size-6 shrink-0 place-items-center rounded-md ${urgent ? "border border-dashed border-gold text-gold" : "bg-surface-raised text-quant"}`}>
              <Icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{title}</span>
              <span className="block truncate text-[10px] text-muted">{detail}</span>
            </span>
            <ChevronRight className="size-3 text-muted" />
          </div>
        ))}
      </div>
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
    <section id="portal" aria-labelledby="portal-heading" className="border-t border-line">
      <div className="page-container py-12 lg:py-16">
        <SectionHeading
          id="portal-heading"
          title="Your prep keeps going between sessions"
        />
        {/* Alternating rows: each screen large beside what it does, not three equal cards. */}
        <div className="mt-10 grid gap-14 lg:gap-20">
          {CARDS.map((card, i) => (
            <article key={card.tag} className="grid items-center gap-8 md:grid-cols-2 lg:gap-16">
              <div className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_30px_80px_-40px_rgb(0_0_0/0.9)] *:border-b-0 ${i % 2 ? "md:order-2" : ""}`}>{card.shot}</div>
              <div>
                <p className="font-mono text-xs tracking-[0.2em] text-quant uppercase">{card.tag}</p>
                <h3 className="mt-2 text-2xl font-normal italic sm:text-3xl">{card.title}</h3>
                <ul className="mt-5 grid gap-3 text-muted">
                  {card.points.map((p) => (
                    <li key={p} className="flex gap-3">
                      <Check aria-hidden className="mt-1 size-4 shrink-0 text-quant" />
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
