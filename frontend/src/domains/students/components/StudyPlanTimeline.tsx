import { GraduationCap, Paperclip } from "lucide-react";

import type { AttemptSummary } from "@/domains/mocks/types";

import { setMyExamDate } from "../actions/myPlan";
import { Batches } from "../services/Batches";
import { StudyDays } from "../services/StudyDays";
import type { StudentSession, StudyPlanItem } from "../types";
import { BUTTON } from "./buttons";
import { SidePanel } from "./SidePanel";
import { StudyCalendar } from "./StudyCalendar";

/**
 * The portal's study plan: a calendar of the plan the instructor keeps in admin Clients, the student's sessions,
 * finished mocks and exam day; beside it the programmes and every attached material. null items = couldn't load.
 */
export function StudyPlanTimeline({
  items,
  programmes,
  exam,
  sessions = [],
  attempts = [],
  bankTopics = [],
  readOnly = false,
}: {
  items: StudyPlanItem[] | null;
  programmes: string[];
  exam: { course: string; date: string; batchDate: string; picked: boolean } | null;
  sessions?: StudentSession[];
  attempts?: AttemptSummary[];
  /** Question-bank topics: a plan topic that matches one gets a topic test. */
  bankTopics?: string[];
  /** The owner viewing as the student: nothing changes. */
  readOnly?: boolean;
}) {
  const today = StudyDays.today();
  const { days, unscheduled } = StudyDays.build({ items: items ?? [], sessions, attempts, exam, bankTopics, today });
  const materials = (items ?? []).filter((i) => i.materialUrl);
  const done = (items ?? []).filter((i) => i.status === "done").length;
  const counted = (items ?? []).filter((i) => i.status !== "skipped").length;
  return (
    // The calendar is the work; programmes and materials fold into a rail on wide screens so it gets the room.
    <SidePanel
      label="Programmes and materials"
      rail={
        <span aria-hidden className="grid gap-3 border-t border-line pt-3 text-[11px]">
          <span className="grid justify-items-center gap-1">
            <GraduationCap strokeWidth={1.75} className="size-5 text-gold" />
            {programmes.length}
          </span>
          <span className="grid justify-items-center gap-1">
            <Paperclip strokeWidth={1.75} className="size-5 text-quant" />
            {materials.length}
          </span>
        </span>
      }
      main={
        <section aria-labelledby="plan-heading" className="min-w-0 rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="plan-heading" className="text-2xl font-normal italic">
              Your study plan
            </h2>
            <p className="text-sm text-muted">
              {[exam && (StudyDays.days(today, exam.date) === 0 ? "Exam today" : `Exam in ${StudyDays.days(today, exam.date)} days`), counted > 0 && `${done} of ${counted} topics done`]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {exam && (
            // CFA sittings run over several days: each student picks theirs, inside their batch's month.
            <form action={setMyExamDate} className={`mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border p-4 text-sm ${exam.picked ? "border-line" : "border-gold/40"}`}>
              <label htmlFor="exam-day" className={exam.picked ? "text-muted" : "font-semibold text-gold"}>
                {exam.picked ? "Your exam day" : "Pick your exam day"}
              </label>
              <input
                id="exam-day"
                name="date"
                type="date"
                required
                disabled={readOnly}
                defaultValue={exam.date}
                {...Batches.examPick(exam.batchDate, today)}
                className="rounded-lg border border-line bg-surface-raised px-3 py-2 text-ink"
              />
              <button type="submit" disabled={readOnly} className={`${BUTTON} disabled:opacity-50`}>
                Save
              </button>
            </form>
          )}
          {items === null ? (
            <p className="text-sm text-muted">Couldn&rsquo;t load your study plan right now. Please refresh in a minute.</p>
          ) : (
            <StudyCalendar
              // A fresh calendar after every save, so it shows what the server now holds.
              key={(items ?? []).map((i) => `${i.id}${i.dueOn}${i.status}`).join()}
              days={days}
              unscheduled={unscheduled}
              today={today}
              last={exam?.date ?? StudyDays.addDays(today, 366)}
              readOnly={readOnly}
            />
          )}
        </section>
      }
    >
      <section aria-labelledby="programmes-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md">
        <h2 id="programmes-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
          Your programmes
        </h2>
        <ul className="mt-3 grid gap-2">
          {programmes.map((p) => (
            <li key={p} className="rounded-xl border border-line border-l-2 border-l-gold bg-surface-raised px-3 py-2 text-sm font-semibold text-ink">
              {p}
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="materials-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md">
        <h2 id="materials-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
          Materials
        </h2>
        {materials.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Notes, documents and links your instructor shares will be listed here.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {materials.map((m) => (
              <li key={m.id}>
                <a
                  href={m.materialUrl!}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-sm text-ink transition-colors hover:border-quant/50 hover:text-quant"
                >
                  <span className="min-w-0 truncate">{m.topic}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SidePanel>
  );
}
