import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Logo } from "@/core/components/layout/Logo";
import { startMock } from "@/domains/mocks/actions/mocks";
import { MockSession } from "@/domains/mocks/server/MockSession";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = { title: "Mock exam instructions", robots: { index: false, follow: false } };

const DOS = [
  "Pause the mock whenever you need to: the clock stops until you resume, and you can go back to the portal and resume from there.",
  "Take notes or write down your understanding of the concept under each question.",
  "Flag questions to come back to them before you submit.",
  "Strike through any answer option you want to eliminate.",
  "Go straight to any question by clicking its number.",
];

const LEGEND: [string, string][] = [
  ["border-line bg-surface", "Not answered"],
  ["border-emerald-400/70 bg-emerald-400/20", "Answered"],
  ["border-gold bg-gold/25", "Flagged for review"],
];

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
    ["Time", twoSessions ? `2 sessions × ${mock.durationMinutes} min` : `${mock.durationMinutes} min`],
    ...(twoSessions ? ([["Break", `Optional ${MockContract.BREAK_MINUTES} min between sessions`]] as [string, string][]) : []),
    ["Format", "Multiple choice, three options (A, B, C)"],
  ];

  return (
    <div className="-mt-20 min-h-screen bg-canvas">
      <header className="border-b border-line">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Logo height={30} priority />
          <span className="truncate font-mono text-xs text-muted">{student.name}</span>
        </div>
      </header>
      <main className="page-container max-w-3xl py-8 lg:py-12">
        <p className="font-mono text-[11px] tracking-[0.22em] text-quant uppercase">{[MockContract.TYPES[mock.mockType], mock.source].filter(Boolean).join(" · ")}</p>
        <h1 className="mt-1 text-3xl font-normal italic">{mock.title}</h1>

        <section aria-labelledby="instructions-heading" className="mt-6 rounded-2xl border border-line bg-surface/60 p-6 sm:p-8">
          <h2 id="instructions-heading" className="text-xl font-semibold">
            Instructions
          </h2>
          <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[8rem_1fr]">
            {facts.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>

          <h3 className="mt-6 font-semibold">During the exam you can</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink/90">
            {DOS.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>

          <h3 className="mt-6 font-semibold">Question numbers</h3>
          <ul className="mt-2 flex flex-wrap gap-4 text-sm">
            {LEGEND.map(([tone, label]) => (
              <li key={label} className="flex items-center gap-2">
                <span aria-hidden className={`size-4 rounded-sm border ${tone}`} /> {label}
              </li>
            ))}
          </ul>

          <h3 className="mt-6 font-semibold">Timing and submitting</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink/90">
            <li>The clock starts when you press Begin and keeps running if you close the page, unless you pause first.</li>
            <li>When time runs out, your answers are submitted automatically.</li>
            {twoSessions && <li>Once session 1 ends you can&rsquo;t go back to its questions.</li>}
            <li>Your results, with an explanation for every question, appear as soon as you submit.</li>
          </ul>
        </section>

        <form action={startMock} className="mt-6 grid gap-4">
          <input type="hidden" name="mockId" value={mock.id} />
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" required className="mt-0.5 size-4 accent-gold" />I have read the instructions and I&rsquo;m ready to begin.
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="h-11 rounded-md bg-gold px-6 font-semibold text-canvas hover:bg-gold-bright">
              Begin exam
            </button>
            <Link href="/student" className="rounded-md border border-line px-4 py-2.5 text-sm text-muted hover:text-ink">
              ← Back to the portal
            </Link>
          </div>
        </form>
      </main>
    </div>
  );
}
