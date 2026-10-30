import Link from "next/link";

import { BUTTON, BOOK_BUTTON } from "@/domains/students/components/buttons";

import { startMock } from "../actions/mocks";
import { MockContract } from "../services/MockContract";
import { MockGrader } from "../services/MockGrader";
import type { AttemptSummary, MockExam } from "../types";

const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";
const DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", year: "numeric" });

/** The portal's mock exams and practice sets: what's available to sit, and every past attempt to revise. null = couldn't load. */
export function MockLobby({ mocks, history, readOnly }: { mocks: MockExam[] | null; history: AttemptSummary[] | null; readOnly: boolean }) {
  if (mocks === null || history === null) {
    return <p className={`${CARD} text-sm text-muted`}>Couldn&rsquo;t load your mock exams right now. Please refresh in a minute.</p>;
  }
  if (mocks.length === 0 && history.length === 0) return null;
  const open = new Map(history.filter((h) => h.status === "in_progress").map((h) => [h.mockId, h.id]));
  // Newest first, so the first completed one per mock is the latest mark.
  const done = (mockId: string) => history.filter((h) => h.mockId === mockId && h.score !== null);
  const exams = mocks.filter((m) => !MockContract.isPractice(m.mockType));
  const practice = (["topic", "chapter"] as const).map((type) => [type, mocks.filter((m) => m.mockType === type)] as const).filter(([, sets]) => sets.length > 0);

  const cards = (items: MockExam[]) => (
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">
      {items.map((m) => {
        const label = MockContract.isPractice(m.mockType) ? "Start set" : "Start mock";
        return (
          <li key={m.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-5">
            <div>
              <p className="font-mono text-[11px] tracking-[0.18em] text-quant uppercase">{MockContract.TYPES[m.mockType]}</p>
              <h3 className="mt-1 text-lg font-semibold">{m.title}</h3>
              {m.source && <p className="text-sm text-muted">{m.source}</p>}
            </div>
            <p className="font-mono text-xs text-muted">
              {m.questionCount} questions ·{" "}
              {MockContract.sessions(m) === 2 ? `2 sessions × ${m.durationMinutes} min, optional ${MockContract.BREAK_MINUTES}-min break` : `${m.durationMinutes} min`}
            </p>
            {done(m.id).length > 0 && (
              <p className="text-xs text-muted">
                Taken {done(m.id).length}× · latest {MockGrader.percent(done(m.id)[0].score!, done(m.id)[0].total)}%. A retake shuffles the questions and keeps every mark.
              </p>
            )}
            {/* A new attempt opens on the instructions first; an open one goes straight back in. */}
            {open.has(m.id) || readOnly ? (
              <form action={startMock} className="mt-auto">
                <input type="hidden" name="mockId" value={m.id} />
                <button type="submit" disabled={readOnly} className={`${BOOK_BUTTON} disabled:opacity-50`}>
                  {open.has(m.id) ? "Resume" : done(m.id).length ? "Retake" : label}
                </button>
              </form>
            ) : (
              <Link href={`/student/mocks/start/${m.id}`} className={`${BOOK_BUTTON} mt-auto self-start`}>
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
