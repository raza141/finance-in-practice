import { ClipboardCheck } from "lucide-react";
import Link from "next/link";

import { BUTTON, BOOK_BUTTON } from "@/domains/students/components/buttons";

import { drillWeakestTopic, startMock } from "../actions/mocks";
import { MockContract } from "../services/MockContract";
import { MockGrader } from "../services/MockGrader";
import type { AttemptSummary, MockExam } from "../types";

const CARD = "rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";
const DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" });

/** The portal's mock exams and practice sets: what's available to sit, and every past attempt to revise. null = couldn't load. */
export function MockLobby({ mocks, history, readOnly }: { mocks: MockExam[] | null; history: AttemptSummary[] | null; readOnly: boolean }) {
  if (mocks === null || history === null) {
    return <p className={`${CARD} text-sm text-muted`}>Couldn&rsquo;t load your mock exams right now. Please refresh in a minute.</p>;
  }
  if (mocks.length === 0 && history.length === 0) return null;
  const open = new Map(history.filter((h) => h.status === "in_progress").map((h) => [h.mockId, h]));
  // Newest first, so the first completed one per mock is the latest mark. A mistakes retake isn't the mock's mark.
  const done = (mockId: string) => history.filter((h) => h.mockId === mockId && h.score !== null && !h.mistakes);
  const exams = mocks.filter((m) => !MockContract.isPractice(m.mockType));
  const practice = (["topic", "chapter"] as const).map((type) => [type, mocks.filter((m) => m.mockType === type)] as const).filter(([, sets]) => sets.length > 0);

  const cards = (items: MockExam[]) => (
    <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {items.map((m) => {
        const label = MockContract.isPractice(m.mockType) ? "Start set" : "Start mock";
        return (
          <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 transition-colors hover:bg-ink/[0.03] sm:px-5">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-raised text-quant">
              <ClipboardCheck strokeWidth={1.75} className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[11px] tracking-[0.18em] text-quant uppercase">
                {m.level === 2 ? `${MockContract.LEVELS[2]} · ` : ""}
                {MockContract.TYPES[m.mockType]}
              </p>
              <h3 className="mt-0.5 font-semibold break-words">{m.title}</h3>
              <p className="text-xs text-muted">
                {m.source && `${m.source} · `}
                {m.questionCount} questions ·{" "}
                {MockContract.sessions(m) === 2 ? `2 sessions × ${m.durationMinutes} min, optional ${MockContract.BREAK_MINUTES}-min break` : `${m.durationMinutes} min`}
              </p>
            {done(m.id).length > 0 && (
              <p className="mt-1 text-xs text-muted">
                Taken {done(m.id).length}× · latest {MockGrader.percent(done(m.id)[0].score!, done(m.id)[0].total)}% · a retake shuffles the questions
              </p>
            )}
            </div>
            {/* A new attempt opens on the instructions first; an open one goes straight back in. */}
            {open.has(m.id) || readOnly ? (
              <form action={startMock} className="shrink-0">
                <input type="hidden" name="mockId" value={m.id} />
                <button type="submit" disabled={readOnly} className={`${BOOK_BUTTON} disabled:opacity-50`}>
                  {open.has(m.id) ? (open.get(m.id)!.mistakes ? "Resume retake" : "Resume") : done(m.id).length ? "Retake" : label}
                </button>
              </form>
            ) : (
              <Link href={`/student/mocks/start/${m.id}`} className={`${BOOK_BUTTON} shrink-0`}>
                {done(m.id).length ? "Retake" : label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <section aria-labelledby="mocks-heading" className={CARD}>
      <h2 id="mocks-heading" className="text-2xl font-normal italic">
        {exams.length === 0 && practice.length > 0 ? "Topic practice" : "Mock exams"}
      </h2>
      {exams.length > 0 && (
        <>
          <p className="mt-1 text-sm text-muted">Timed, exam-style. The clock keeps running if you close the page; results and explanations appear the moment you submit.</p>
          {cards(exams)}
        </>
      )}

      {practice.length > 0 && (
        <div className={exams.length > 0 ? "mt-8" : "mt-1"}>
          {exams.length > 0 && <h2 className="text-2xl font-normal italic">Topic practice</h2>}
          <p className="mt-1 text-sm text-muted">Short graded sets: submit, then see your score and every explanation.</p>
          {practice.map(([type, sets]) => (
            <div key={type} className="mt-5">
              <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{MockContract.TYPES[type]}</h3>
              {cards(sets)}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-8">
          <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Past attempts</h3>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{h.mockTitle}</span>
                  {h.mistakes && <span className="ml-2 rounded-full border border-gold/40 px-2 py-0.5 text-[11px] text-gold">Mistakes retake</span>}
                  <span className="block font-mono text-xs text-muted">{DAY.format(h.startedAt)}</span>
                </span>
                <span className="flex items-center gap-4">
                  {h.score !== null ? (
                    <span className="font-mono">
                      {h.score}/{h.total} <span className="text-muted">({MockGrader.percent(h.score, h.total)}%)</span>
                    </span>
                  ) : (
                    <span className="font-mono text-xs text-gold">In progress</span>
                  )}
                  {readOnly ? null : (
                    <Link href={`/student/mocks/${h.id}`} className={BUTTON}>
                      {h.status === "completed" ? "Revise / view results" : "Resume"}
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Mocks → Topic drill: new questions from the student's weakest topic, started at once. */
export function TopicDrill({ readOnly }: { readOnly: boolean }) {
  return (
    <section aria-labelledby="drill-heading" className={CARD}>
      <h2 id="drill-heading" className="text-2xl font-normal italic">
        Topic drill
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        {MockContract.DRILL_SIZE} questions you haven&rsquo;t seen, from the topic your mocks show is weakest. Graded the moment you submit, with every explanation.
      </p>
      <form action={drillWeakestTopic} className="mt-5">
        <button type="submit" disabled={readOnly} className={`${BOOK_BUTTON} disabled:opacity-50`}>
          Start a drill
        </button>
      </form>
    </section>
  );
}
