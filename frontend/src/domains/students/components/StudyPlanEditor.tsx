import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { addStudyMock, addStudyTopics, removeStudyTopic, updateStudyTopic } from "../actions/studyPlan";
import { StudyPlanContract } from "../services/StudyPlanContract";
import type { StudyPlanItem } from "../types";

const CHANGED = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The admin side of a student's study plan: what they see under "Your study plan" on /student. */
export function StudyPlanEditor({ clientId, items, mocks }: { clientId: string; items: StudyPlanItem[]; mocks: { id: string; title: string }[] }) {
  return (
    <section id="study-plan" className="mt-12 scroll-mt-16 rounded-lg border border-line p-5">
      <h2 className="text-lg">Study plan</h2>
      <p className="mt-1 text-sm text-muted">
        The student sees this timeline after signing in at /student. For materials, link a Google Drive file shared with their email, and only
        your own notes: re-sharing paid prep books breaks their copyright.
      </p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No topics yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line/60">
          {items.map((item) => (
            <li key={item.id} className="py-3">
              <form action={updateStudyTopic} className="grid items-end gap-2 sm:grid-cols-[9rem_9rem_1fr_7rem_auto]">
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="itemId" value={item.id} />
                <input name="startOn" type="date" aria-label="From (a range)" title="From (a range)" defaultValue={item.startOn ?? ""} className={FIELD} />
                <input name="dueOn" type="date" aria-label="Date, or the range's last day" title="Date, or the range's last day" defaultValue={item.dueOn ?? ""} className={FIELD} />
                <input name="topic" aria-label="Topic" required maxLength={StudyPlanContract.LIMITS.topic[1]} defaultValue={item.topic} className={FIELD} />
                <select name="status" aria-label="Status" defaultValue={item.status} className={FIELD}>
                  {Object.entries(StudyPlanContract.STATUSES).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <PendingButton pendingLabel="Saving…" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
                  Save
                </PendingButton>
                <input
                  name="materialUrl"
                  type="url"
                  aria-label="Material link"
                  placeholder="Material link (https://drive.google.com/…)"
                  defaultValue={item.materialUrl ?? ""}
                  className={`${FIELD} sm:col-span-2`}
                />
                <select name="mockId" aria-label="Mock" defaultValue={item.mockId ?? ""} className={FIELD}>
                  <option value="">No mock</option>
                  {mocks.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title}
                    </option>
                  ))}
                </select>
                <input
                  name="note"
                  aria-label="Note"
                  placeholder="Note for the student (optional)"
                  maxLength={StudyPlanContract.LIMITS.note}
                  defaultValue={item.note}
                  className={`${FIELD} sm:col-span-2`}
                />
              </form>
              {item.studentChangedAt && (
                <p className="mt-1 text-xs text-gold">
                  Changed by student {CHANGED.format(new Date(item.studentChangedAt))}. Saving the topic clears this.
                </p>
              )}
              <form action={removeStudyTopic} className="mt-1 text-right">
                <input type="hidden" name="clientId" value={clientId} />
                <input type="hidden" name="itemId" value={item.id} />
                <PendingButton pendingLabel="Removing…" className="text-xs text-red-300/90 hover:underline">
                  Remove
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      )}

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
