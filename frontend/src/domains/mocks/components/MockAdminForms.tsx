"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { buildMockFromPool, saveMock, setMockAccess, uploadMockQuestions, type MockActionState } from "../actions/mocks";
import { MockContract } from "../services/MockContract";
import type { MockAudience, MockExam, MockStudent } from "../types";

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

/** Submits without React's reset after the action, so ticks and choices stay as they were sent (as SettingsForm). */
function keep(action: (data: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };
}

function SaveButton({ busy, busyLabel, children }: { busy: boolean; busyLabel: string; children: string }) {
  return (
    <button type="submit" disabled={busy} aria-busy={busy} className={`${SAVE} disabled:cursor-wait disabled:opacity-60`}>
      {busy ? busyLabel : children}
    </button>
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
      <details className="rounded-lg border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium">Tables and charts (FSA statements, term structures)</summary>
        <p className="mt-2 text-muted">
          In the Vignette, Question or Explanation cell, one row per line (Alt+Enter in Excel). The first row is the header. A title line just above is optional:
          &ldquo;Exhibit 1: …&rdquo; or &ldquo;Table: …&rdquo; for a table, &ldquo;Chart: …&rdquo; to draw the rows as a line chart.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <pre className="overflow-x-auto rounded-md bg-canvas/80 p-3 font-mono text-xs">
            {"Exhibit 1: Delta Corp (AED m)\n| Item | 2025 | 2024 |\n| Revenue | 840 | 790 |\n| COGS | (510) | (480) |\n| LIFO reserve | 26 | 18 |"}
          </pre>
          <pre className="overflow-x-auto rounded-md bg-canvas/80 p-3 font-mono text-xs">
            {"Chart: Spot rate curve\n| Maturity (years) | Spot rate (%) |\n| 1 | 3.20 |\n| 2 | 3.65 |\n| 3 | 3.90 |\n| 5 | 4.10 |"}
          </pre>
        </div>
        <p className="mt-2 text-muted">Up to 40 rows, 8 columns and 3 lines per chart. Cells take maths ($…$) and bold (**…**). A broken table is reported by row number and nothing is saved.</p>
      </details>
      <div className="flex flex-wrap items-start gap-4">
        <PendingButton pendingLabel="Checking…" className={SAVE}>
          Upload questions
        </PendingButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

const BOX = "flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm has-[:checked]:border-quant/70";

/** A new draft mock of random questions from the ones already uploaded, by topic and optionally by source mock. */
export function MockPoolForm({ topics, mocks }: { topics: { topic: string; count: number }[]; mocks: MockExam[] }) {
  const [state, action, busy] = useActionState(buildMockFromPool, null);
  return (
    <form onSubmit={keep(action)} className="grid gap-4 sm:grid-cols-2">
      <fieldset className="sm:col-span-2">
        <legend className="text-[11px] tracking-[0.22em] text-muted uppercase">Topics</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {topics.map((t) => (
            <label key={t.topic} className={BOX}>
              <input type="checkbox" name="topic" value={t.topic} />
              {t.topic} <span className="font-mono text-xs text-muted">{t.count}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className="sm:col-span-2">
        <legend className="text-[11px] tracking-[0.22em] text-muted uppercase">From these mocks (none ticked: all)</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {mocks.map((m) => (
            <label key={m.id} className={BOX}>
              <input type="checkbox" name="from" value={m.id} />
              {m.title}
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Title" className="sm:col-span-2">
        <input name="title" required minLength={3} maxLength={120} placeholder="FSA topic mock 1" className={FIELD} />
      </Field>
      <Field label="Questions" hint="Fewer in the pool than this? It takes them all.">
        <input name="count" type="number" required min={1} max={MockContract.MAX_QUESTIONS} defaultValue={30} className={FIELD} />
      </Field>
      <Field label="Duration (minutes)">
        <input name="durationMinutes" type="number" required min={1} max={600} defaultValue={45} className={FIELD} />
      </Field>
      <Field label="Type">
        <select name="mockType" defaultValue="topic" className={FIELD}>
          {Object.entries(MockContract.TYPES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Book or source">
        <input name="source" maxLength={120} placeholder="Question pool" defaultValue="Question pool" className={FIELD} />
      </Field>
      <div className="flex items-center gap-4 sm:col-span-2">
        <SaveButton busy={busy} busyLabel="Building…">
          Build draft mock
        </SaveButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

/** Who can see and start the mock: everyone, students on ticked courses, or ticked clients. */
export function MockAccessForm({ mock, students, granted }: { mock: MockExam; students: MockStudent[]; granted: string[] }) {
  const [state, action, busy] = useActionState(setMockAccess, null);
  const [audience, setAudience] = useState<MockAudience>(mock.audience);
  const [query, setQuery] = useState("");
  // Courses as written on the clients' records, plus any the mock still names that no client has now.
  const courses = [...new Set([...students.flatMap((s) => s.courses), ...mock.courses])].sort();
  const q = query.trim().toLowerCase();
  return (
    <form onSubmit={keep(action)} className="grid gap-4">
      <input type="hidden" name="id" value={mock.id} />
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Who can take this mock</legend>
        {Object.entries(MockContract.AUDIENCES).map(([value, label]) => (
          <label key={value} className={BOX}>
            <input type="radio" name="audience" value={value} defaultChecked={mock.audience === value} onChange={() => setAudience(value as MockAudience)} />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset hidden={audience !== "course"}>
        <legend className="text-[11px] tracking-[0.22em] text-muted uppercase">Courses</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {courses.map((c) => (
            <label key={c} className={BOX}>
              <input type="checkbox" name="course" value={c} defaultChecked={mock.courses.includes(c)} />
              {c} <span className="font-mono text-xs text-muted">{students.filter((s) => s.courses.includes(c)).length}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset hidden={audience !== "clients"}>
        <legend className="text-[11px] tracking-[0.22em] text-muted uppercase">Clients</legend>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by name or email" className={FIELD} />
        <ul className="mt-2 grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
          {students.map((s) => (
            // Filtered rows are hidden, not removed, so their ticks still submit.
            <li key={s.id} hidden={!!q && !`${s.name} ${s.email}`.toLowerCase().includes(q)}>
              <label className={BOX}>
                <input type="checkbox" name="client" value={s.id} defaultChecked={granted.includes(s.id)} />
                <span className="min-w-0">
                  {s.name} <span className="block truncate text-xs text-muted">{s.email}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="flex items-center gap-4">
        <SaveButton busy={busy} busyLabel="Saving…">
          Save access
        </SaveButton>
        <Notice state={state} />
      </div>
    </form>
  );
}
