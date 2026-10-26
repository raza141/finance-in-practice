import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { Logo } from "@/core/components/layout/Logo";
import { startMock } from "@/domains/mocks/actions/mocks";
import { MockSession } from "@/domains/mocks/server/MockSession";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { BackToPortal } from "@/domains/students/components/BackToPortal";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = { title: "Mock exam instructions", robots: { index: false, follow: false } };

// [symbol, tool, what it does]: the player's own controls, in the order a student meets them.
const TOOLS: [string, string, string][] = [
  ["⏸", "Pause", "The clock stops. You can leave and resume later from the portal."],
  ["✎", "Notes", "Write your understanding of the concept under each question."],
  ["⚐", "Flag", "Mark a question to come back to before you submit."],
  ["S̶", "Strike through", "Eliminate an option you've ruled out."],
  ["#", "Jump", "Click any question number to go straight to it."],
];

// The player's palette tiles, exactly as they look in the exam.
const LEGEND: [string, string, string][] = [
  ["1", "border-line bg-surface text-muted", "Not answered"],
  ["2", "border-emerald-400/70 bg-emerald-400/20 text-emerald-200", "Answered"],
  ["3", "border-gold bg-gold/25 text-gold", "Flagged for review"],
];

const CARD = "rounded-2xl border border-line bg-surface/60 p-5 sm:p-6";
const HEADING = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";

/** The exam's instruction screen, as at the CBT centre: read, tick, then Begin starts the clock. Nothing is created until Begin. */
export default async function MockInstructionsPage({ params }: PageProps<"/student/mocks/start/[mockId]">) {
  const [student, { mockId }] = await Promise.all([StudentAuth.current(), params]);
  if (!student) redirect("/student");
  if (!MockContract.isUuid(mockId)) notFound();
  // Same rule as the lobby: only a mock open to this student.
  const mock = (await MockSession.repo().published(student.id)).find((m) => m.id === mockId);
  if (!mock) notFound();
  const twoSessions = MockContract.sessions(mock) === 2;
  const facts: [string, string][] = [
    ["Questions", String(mock.questionCount)],
    ["Time", twoSessions ? `2 × ${mock.durationMinutes} min` : `${mock.durationMinutes} min`],
    ...(twoSessions ? ([["Break", `${MockContract.BREAK_MINUTES} min, optional`]] as [string, string][]) : []),
    ["Format", "MCQ · A, B, C"],
  ];
  const timing = [
    "The clock starts when you press Begin.",
    "It keeps running if you close the page, unless you pause first.",
    ...(twoSessions ? ["Session 1's questions lock once it ends."] : []),
    "When time runs out, your answers are submitted automatically.",
    "Results, with an explanation for every question, appear as soon as you submit.",
  ];

  return (
    <div className="-mt-20 min-h-screen bg-canvas">
      <header className="border-b border-line">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Logo height={30} priority />
          <span className="truncate font-mono text-xs text-muted">{student.name}</span>
        </div>
      </header>
      <main className="page-container grid max-w-4xl gap-6 py-8 lg:py-12">
        <div>
          <p className="font-mono text-[11px] tracking-[0.22em] text-quant uppercase">{[MockContract.TYPES[mock.mockType], mock.source].filter(Boolean).join(" · ")}</p>
          <h1 className="mt-1 text-3xl font-normal italic">{mock.title}</h1>
          <p className="mt-1 text-sm text-muted">Please read these instructions before you begin.</p>
        </div>

        <dl className={`grid grid-cols-2 gap-3 ${facts.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-line bg-surface/60 p-4">
              <dt className={HEADING}>{k}</dt>
              <dd className="mt-1 text-xl font-semibold text-ink">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="grid items-start gap-6 md:grid-cols-2">
          <section aria-labelledby="tools-heading" className={CARD}>
            <h2 id="tools-heading" className={HEADING}>
              During the exam
            </h2>
            <ul className="mt-4 grid gap-4">
              {TOOLS.map(([icon, name, what]) => (
                <li key={name} className="flex gap-3">
                  <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-lg border border-line bg-canvas font-mono text-sm text-quant">
                    {icon}
                  </span>
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">{name}</span>
                    <span className="text-muted">{what}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-6">
            <section aria-labelledby="legend-heading" className={CARD}>
              <h2 id="legend-heading" className={HEADING}>
                Question numbers
              </h2>
              <ul className="mt-4 grid gap-3">
                {LEGEND.map(([n, tone, label]) => (
                  <li key={label} className="flex items-center gap-3 text-sm text-ink">
                    <span aria-hidden className={`grid h-9 w-11 place-items-center rounded-md border font-mono text-xs ${tone}`}>
                      {n}
                    </span>
                    {label}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="timing-heading" className={CARD}>
              <h2 id="timing-heading" className={HEADING}>
                Timing and submitting
              </h2>
              <ol className="mt-4 grid gap-3 text-sm">
                {timing.map((t, i) => (
                  <li key={t} className="flex gap-3">
                    <span aria-hidden className="font-mono text-quant">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-ink/90">{t}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>

        <form action={startMock} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gold/40 bg-gold/5 p-5 sm:p-6">
          <input type="hidden" name="mockId" value={mock.id} />
          <label className="flex items-center gap-3 text-sm text-ink">
            <input type="checkbox" required className="size-4 accent-gold" />
            I have read the instructions and I&rsquo;m ready to begin.
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <BackToPortal />
            <button type="submit" className="h-11 rounded-md bg-gold px-6 font-semibold text-canvas hover:bg-gold-bright">
              Begin exam
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
