"use client";

import { useState } from "react";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { addStudyBook } from "../actions/studyPlan";
import { StudyDays } from "../services/StudyDays";
import { StudyPlanContract } from "../services/StudyPlanContract";

type Step = (typeof StudyPlanContract.BOOK_STEPS)[number][0];

/** Where each test lands by default: the half-book test mid-range, the full-book test on the last day, the mock the day after. */
function defaults(from: string, to: string): Record<Step, string> {
  if (!from || !to || to < from) return { half: "", full: "", mock: "" };
  return { half: StudyDays.addDays(from, Math.floor(StudyDays.days(from, to) / 2)), full: to, mock: StudyDays.addDays(to, 1) };
}

/** Admin: one book over a range, with its tests and mock, from the day clicked on the plan calendar. */
export function PlanBookForm({ clientId, from: start, mocks }: { clientId: string; from: string; mocks: { id: string; title: string }[] }) {
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState(StudyDays.addDays(start, 27));
  const [on, setOn] = useState<Record<Step, boolean>>({ half: true, full: true, mock: true });
  const [dates, setDates] = useState(() => defaults(start, StudyDays.addDays(start, 27)));
  const range = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setDates(defaults(f, t));
  };
  return (
    <form action={addStudyBook} className="grid gap-3 border-t border-line pt-4 text-sm">
      <h4 className="font-semibold">Plan a book</h4>
      <input type="hidden" name="clientId" value={clientId} />
      <select name="book" required defaultValue="" aria-label="Book" className={FIELD}>
        <option value="" disabled>
          Choose a book
        </option>
        {Object.entries(StudyPlanContract.BOOKS).map(([group, books]) => (
          <optgroup key={group} label={group}>
            {books.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted">
          Start
          <input name="startOn" type="date" required value={from} onChange={(e) => range(e.target.value, to)} className={FIELD} />
        </label>
        <label className="text-xs text-muted">
          End
          <input name="dueOn" type="date" required min={from} value={to} onChange={(e) => range(from, e.target.value)} className={FIELD} />
        </label>
      </div>
      {StudyPlanContract.BOOK_STEPS.map(([key, name]) => (
        <div key={key} className="grid items-end gap-2 sm:grid-cols-[10rem_9.5rem_1fr]">
          <label className="flex h-11 items-center gap-2">
            <input type="checkbox" checked={on[key]} onChange={(e) => setOn({ ...on, [key]: e.target.checked })} className="h-4 w-4 accent-[var(--color-quant)]" />
            {name}
          </label>
          {/* Unticked: disabled, so the browser leaves it out of the form. */}
          <input name={`${key}On`} type="date" aria-label={`${name} day`} required={on[key]} disabled={!on[key]} value={dates[key]} onChange={(e) => setDates({ ...dates, [key]: e.target.value })} className={FIELD} />
          <select name={`${key}Mock`} aria-label={`${name} mock`} disabled={!on[key]} defaultValue="" className={FIELD}>
            <option value="">No mock linked</option>
            {mocks.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>
      ))}
      <PendingButton pendingLabel="Adding…" className="h-9 justify-self-start rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
        Add to plan
      </PendingButton>
    </form>
  );
}
