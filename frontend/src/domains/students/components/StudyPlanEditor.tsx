import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { addStudyMock, addStudyTopics } from "../actions/studyPlan";
import type { AttemptSummary } from "@/domains/mocks/types";

import { StudyDays } from "../services/StudyDays";
import type { StudyPlanItem } from "../types";
import { StudyCalendar } from "./StudyCalendar";

/** The admin side of a student's study plan: what they see under "Your study plan" on /student. */
export function StudyPlanEditor({
  clientId,
  items,
  mocks,
  attempts,
  exam,
}: {
  clientId: string;
  items: StudyPlanItem[];
  mocks: { id: string; title: string }[];
  attempts: AttemptSummary[];
  exam: { course: string; date: string } | null;
}) {
  const today = StudyDays.today();
  const { days, unscheduled } = StudyDays.build({ items, sessions: [], attempts, exam, bankTopics: [], allUndated: true, today });
  return (
    <section id="study-plan" className="mt-12 scroll-mt-16 rounded-lg border border-line p-5">
      <h2 className="text-lg">Study plan</h2>
      <p className="mt-1 text-sm text-muted">
        The student sees this timeline after signing in at /student. For materials, link a Google Drive file shared with their email, and only
        your own notes: re-sharing paid prep books breaks their copyright.
      </p>

      <div className="mt-4">
        {/* What the student's calendar shows: click a day to plan a book from it, or anything on it to edit it. */}
        <StudyCalendar key={JSON.stringify([days, unscheduled])} days={days} unscheduled={unscheduled} today={today} last={exam?.date ?? StudyDays.addDays(today, 366)} readOnly planner={{ clientId, mocks }} />
      </div>

      <details className="mt-4" open={items.length === 0}>
        <summary className="cursor-pointer text-sm text-quant">+ Add topics</summary>
        <form action={addStudyTopics} className="mt-3 grid gap-3">
          <input type="hidden" name="clientId" value={clientId} />
          <label className="text-xs text-muted">
            One topic per line. Start a line with a date (or a range, 2026-11-01..2026-11-30) to schedule it, and end it with a link to attach material.
            <textarea
              name="lines"
              required
              rows={5}
              placeholder={"2026-11-01..2026-11-30 Books 1–2\n2026-11-03 Ethics & Professional Standards https://drive.google.com/…\n2026-11-10 Quantitative Methods"}
              className={`${FIELD} mt-1 font-mono`}
            />
          </label>
          <PendingButton pendingLabel="Adding…" className="h-9 justify-self-start rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
            Add to plan
          </PendingButton>
        </form>
      </details>

      {mocks.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-quant">+ Schedule a mock</summary>
          <form action={addStudyMock} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="hidden" name="clientId" value={clientId} />
            <input name="dueOn" type="date" required aria-label="Mock day" className={`${FIELD} w-40`} />
            <select name="mockId" required aria-label="Mock" defaultValue="" className={`${FIELD} w-auto min-w-56`}>
              <option value="" disabled>
                Choose a mock
              </option>
              {mocks.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
            <PendingButton pendingLabel="Adding…" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
              Add to plan
            </PendingButton>
          </form>
        </details>
      )}
    </section>
  );
}
