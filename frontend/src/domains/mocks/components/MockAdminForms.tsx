"use client";

import { useActionState } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { saveMock, uploadMockQuestions, type MockActionState } from "../actions/mocks";
import { MockContract } from "../services/MockContract";
import type { MockExam } from "../types";

const SAVE = "h-10 rounded-md bg-gold px-5 text-sm font-semibold text-canvas hover:bg-gold-bright";

function Notice({ state }: { state: MockActionState }) {
  if (!state) return null;
  return (
    <div role={state.ok ? "status" : "alert"} className={`text-sm ${state.ok ? "text-emerald-300" : "text-gold"}`}>
      <p>{state.message}</p>
      {state.errors && (
        <ul className="mt-2 max-h-64 list-disc overflow-y-auto pl-5 text-xs">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** New mock (no `mock`) or its details. */
export function MockExamForm({ mock }: { mock?: MockExam }) {
  const [state, action] = useActionState(saveMock, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      {mock && <input type="hidden" name="id" value={mock.id} />}
      <Field label="Title" className="sm:col-span-2">
        <input name="title" required minLength={3} maxLength={120} defaultValue={mock?.title} placeholder="Book 3 · Financial Statement Analysis" className={FIELD} />
      </Field>
      <Field label="Type">
        <select name="mockType" defaultValue={mock?.mockType ?? "book"} className={FIELD}>
          {Object.entries(MockContract.TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Duration (minutes)" hint={mock?.attempted ? "Open attempts keep the time they started with." : "CFA Level I: 135 per session."}>
        <input name="durationMinutes" type="number" required min={1} max={600} defaultValue={mock?.durationMinutes ?? 135} className={FIELD} />
      </Field>
      <Field label="Book or source" className="sm:col-span-2">
        <input name="source" maxLength={120} defaultValue={mock?.source} placeholder="Book 2: Quantitative Methods, or Random pool" className={FIELD} />
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2">
        <PendingButton pendingLabel="Saving…" className={SAVE}>
          {mock ? "Save details" : "Create mock"}
        </PendingButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

/** The question sheet: a CSV file, or rows copied from Excel and pasted. */
export function MockUploadForm({ mockId }: { mockId: string }) {
  const [state, action] = useActionState(uploadMockQuestions, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="id" value={mockId} />
      <Field label="CSV file" hint="In Excel: File → Save As → CSV UTF-8. Maths as $…$ or $$…$$; amounts like $40m stay text, but write \$ for a dollar sign that could pair up.">
        <input name="file" type="file" accept=".csv,.tsv,.txt,text/csv" className={`${FIELD} text-sm`} />
      </Field>
      <Field label="…or paste the rows from Excel" hint="Select the whole table including the header row, copy, paste here.">
        <textarea name="paste" rows={6} className={`${FIELD} font-mono text-xs`} placeholder={"Number\tTopic\tVignette (Optional)\tQuestion\tOption_A\tOption_B\tOption_C\tCorrect_Option\tExplanation (Optional)"} />
      </Field>
      <div className="flex flex-wrap items-start gap-4">
        <PendingButton pendingLabel="Checking…" className={SAVE}>
          Upload questions
        </PendingButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
