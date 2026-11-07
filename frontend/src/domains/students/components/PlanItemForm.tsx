"use client";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { removeStudyTopic, updateStudyTopic } from "../actions/studyPlan";
import type { StudyTopic } from "../services/StudyDays";
import { StudyPlanContract } from "../services/StudyPlanContract";

const CHANGED = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Admin: one plan item, edited in the calendar's dialog (the item clicked), so the page isn't a wall of forms. */
export function PlanItemForm({ item, clientId, mocks }: { item: StudyTopic; clientId: string; mocks: { id: string; title: string }[] }) {
  return (
    <div className="grid gap-3">
      <form action={updateStudyTopic} className="grid gap-3 text-sm">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="itemId" value={item.id} />
        <input name="topic" aria-label="Topic" required maxLength={StudyPlanContract.LIMITS.topic[1]} defaultValue={item.topic} className={`${FIELD} font-semibold`} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <label className="text-xs text-muted">
            From
            <input name="startOn" type="date" defaultValue={item.startOn} className={FIELD} />
          </label>
          <label className="text-xs text-muted">
            {item.startOn ? "To" : "Date"}
            <input name="dueOn" type="date" defaultValue={item.dueOn} className={FIELD} />
          </label>
          <label className="text-xs text-muted">
            Status
            <select name="status" defaultValue={item.status} className={FIELD}>
              {Object.entries(StudyPlanContract.STATUSES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="text-xs text-muted">
          Mock
          <select name="mockId" defaultValue={item.mock?.id ?? ""} className={FIELD}>
            <option value="">No mock</option>
            {mocks.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted">
          Material link
          <input name="materialUrl" type="url" placeholder="https://drive.google.com/…" defaultValue={item.materialUrl ?? ""} className={FIELD} />
        </label>
        <label className="text-xs text-muted">
          Note for the student
          <input name="note" maxLength={StudyPlanContract.LIMITS.note} defaultValue={item.note} className={FIELD} />
        </label>
        {item.studentChangedAt && <p className="text-xs text-gold">Changed by student {CHANGED.format(new Date(item.studentChangedAt))}</p>}
        <PendingButton pendingLabel="Saving…" className="h-9 justify-self-start rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
          Save
        </PendingButton>
      </form>
      <form action={removeStudyTopic} className="justify-self-end">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="itemId" value={item.id} />
        <PendingButton pendingLabel="Removing…" className="text-xs text-red-300/90 hover:underline">
          Remove
        </PendingButton>
      </form>
    </div>
  );
}
