"use client";

import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { buildMockFromPool, saveMock, saveMockQuestion, setMockAccess, uploadMockQuestions, type MockActionState } from "../actions/mocks";
import { MockContract } from "../services/MockContract";
import { MockExhibits } from "../services/MockExhibits";
import type { MockAudience, MockExam, MockQuestion, MockStudent, MockType } from "../types";
import { QuestionPreview } from "./QuestionPreview";

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

function SaveButton({ busy, busyLabel, disabled = false, children }: { busy: boolean; busyLabel: string; disabled?: boolean; children: string }) {
  return (
    <button type="submit" disabled={busy || disabled} aria-busy={busy} className={`${SAVE} disabled:cursor-wait disabled:opacity-60`}>
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
      <Field
        label="Duration (minutes)"
        hint={
          mock?.attempted
            ? "Open attempts keep the time they started with."
            : "Full syllabus sits in two sessions (half the questions each) with this time per session and an optional 30-minute break: CFA Level I is 135. Other types are one sitting."
        }
      >
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
      <p className="text-sm text-muted">
        <a href="/templates/mock-questions-template.xlsx" download className="text-quant hover:underline">
          Download the Excel template
        </a>{" "}
        (the columns, topic and answer dropdowns, and examples of a question set, a table and a term-structure chart).
      </p>
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

export type BankTopic = { topic: string; questions: { id: string; label: string; summary: ReactNode; preview: ReactNode }[] };

const NUMBER = "h-9 w-20 rounded-md border border-line bg-canvas/70 px-2 text-ink outline-none focus:border-quant/70";

/**
 * A new draft mock from the question bank: per topic, tick questions and/or give a number (ticked ones
 * count towards it, the rest are drawn at random). The duration follows the CFA pace until it's typed.
 */
export function MockBankForm({ topics, from }: { topics: BankTopic[]; from: string[] }) {
  const [state, action, busy] = useActionState(buildMockFromPool, null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [ticked, setTicked] = useState<Set<string>>(() => new Set());
  const [mockType, setMockType] = useState<MockType>("topic");
  const [duration, setDuration] = useState<string | null>(null);
  const toggle = (id: string) =>
    setTicked((t) => {
      const next = new Set(t);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const inMock = (t: BankTopic) => Math.max(t.questions.filter((q) => ticked.has(q.id)).length, Math.min(Number(counts[t.topic]) || 0, t.questions.length));
  const total = topics.reduce((n, t) => n + inMock(t), 0);

  return (
    <form onSubmit={keep(action)} className="grid gap-6">
      {from.map((id) => (
        <input key={id} type="hidden" name="from" value={id} />
      ))}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {topics.map((t) => {
          const picked = t.questions.filter((q) => ticked.has(q.id)).length;
          return (
            <li key={t.topic} className="p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <p className="min-w-0 basis-full font-medium sm:basis-0 sm:flex-1">
                  {t.topic} <span className="font-mono text-xs text-muted">{t.questions.length} in the bank</span>
                </p>
                <input type="hidden" name="topic" value={t.topic} />
                <label className="flex items-center gap-2 text-sm text-muted">
                  Questions
                  <input
                    name="count"
                    type="number"
                    min={0}
                    max={t.questions.length}
                    placeholder="0"
                    value={counts[t.topic] ?? ""}
                    onChange={(e) => setCounts((c) => ({ ...c, [t.topic]: e.target.value }))}
                    className={NUMBER}
                  />
                </label>
                <span className="font-mono text-xs whitespace-nowrap text-muted sm:w-36 sm:text-right">
                  {picked > 0 && <span className="text-quant">{picked} ticked · </span>}
                  {inMock(t)} in mock
                </span>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-quant">Pick questions</summary>
                <ul className="mt-2 grid gap-1">
                  {t.questions.map((q) => (
                    <li key={q.id} className="rounded-md border border-line px-3 py-2 has-[:checked]:border-quant/70">
                      <label className="flex items-start gap-3 text-sm">
                        <input type="checkbox" name="q" value={q.id} checked={ticked.has(q.id)} onChange={() => toggle(q.id)} className="mt-1" />
                        <span className="min-w-0">
                          <span className="line-clamp-2">{q.summary}</span>
                          <span className="block font-mono text-xs text-muted">{q.label}</span>
                        </span>
                      </label>
                      <details className="mt-1 pl-7">
                        <summary className="cursor-pointer text-xs text-muted">Preview</summary>
                        <div className="mt-2 text-sm">{q.preview}</div>
                      </details>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          );
        })}
      </ul>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <input name="title" required minLength={3} maxLength={120} placeholder="Recall mock: FI, FSA, Derivatives" className={FIELD} />
        </Field>
        <Field label="Type">
          <select name="mockType" value={mockType} onChange={(e) => setMockType(e.target.value as MockType)} className={FIELD}>
            {Object.entries(MockContract.TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Duration (minutes)"
          hint={`Set at the CFA pace, ${MockContract.MINUTES_PER_QUESTION} min a question${mockType === "full" ? ", per session (half the questions each)" : ""}. Type to change it.`}
        >
          <input
            name="durationMinutes"
            type="number"
            required
            min={1}
            max={600}
            value={duration ?? MockContract.minutes(total, mockType)}
            onChange={(e) => setDuration(e.target.value)}
            className={FIELD}
          />
        </Field>
        <Field label="Book or source" className="sm:col-span-2">
          <input name="source" maxLength={120} defaultValue="Question bank" className={FIELD} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SaveButton busy={busy} disabled={total === 0} busyLabel="Building…">
          {`Build draft mock · ${total} question${total === 1 ? "" : "s"}`}
        </SaveButton>
        <Notice state={state} />
      </div>
    </form>
  );
}

const TEXT_FIELDS = [
  ["vignette", "Vignette (optional)", 6],
  ["question", "Question", 4],
  ["a", "Option A", 2],
  ["b", "Option B", 2],
  ["c", "Option C", 2],
  ["explanation", "Explanation (optional)", 4],
] as const;
type QuestionFields = Record<"number" | "topic" | "correct" | (typeof TEXT_FIELDS)[number][0], string>;

/** One question, added (no `question`) or edited, with the preview beside it as students will see it. */
export function MockQuestionForm({ mockId, question, nextNumber, topics }: { mockId: string; question?: MockQuestion; nextNumber: number; topics: string[] }) {
  const [state, action, busy] = useActionState(saveMockQuestion, null);
  const [f, setF] = useState<QuestionFields>(() => ({
    number: String(question?.number ?? nextNumber),
    topic: question?.topic ?? "",
    correct: question?.correct ?? "A",
    vignette: question?.vignette ?? "",
    question: question?.question ?? "",
    a: question?.options[0] ?? "",
    b: question?.options[1] ?? "",
    c: question?.options[2] ?? "",
    explanation: question?.explanation ?? "",
  }));
  const set = (k: keyof QuestionFields) => (e: { target: { value: string } }) => setF((v) => ({ ...v, [k]: e.target.value }));
  const exhibitProblems = [
    ...MockExhibits.problems(f.vignette, "Vignette"),
    ...MockExhibits.problems(f.question, "Question"),
    ...MockExhibits.problems(f.explanation, "Explanation"),
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={keep(action)} className="grid content-start gap-4">
        <input type="hidden" name="id" value={mockId} />
        {question && <input type="hidden" name="questionId" value={question.id} />}
        <div className="grid grid-cols-[6rem_1fr_6rem] gap-3">
          <Field label="Number">
            <input name="number" type="number" required min={1} max={MockContract.MAX_QUESTIONS} value={f.number} onChange={set("number")} className={FIELD} />
          </Field>
          <Field label="Topic">
            <input name="topic" required maxLength={80} list="mock-topics" value={f.topic} onChange={set("topic")} className={FIELD} />
            <datalist id="mock-topics">
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </Field>
          <Field label="Correct">
            <select name="correct" value={f.correct} onChange={set("correct")} className={FIELD}>
              {MockContract.LETTERS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
        </div>
        {TEXT_FIELDS.map(([name, label, rows]) => (
          <Field key={name} label={label}>
            <textarea name={name} rows={rows} required={name === "question" || name.length === 1} value={f[name]} onChange={set(name)} className={`${FIELD} font-mono text-xs`} />
          </Field>
        ))}
        <div className="flex flex-wrap items-start gap-4">
          <SaveButton busy={busy} busyLabel="Saving…">
            {question ? "Save question" : "Add question"}
          </SaveButton>
          <Notice state={state} />
        </div>
      </form>
      <section aria-label="Preview" className="content-start lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Preview</p>
        {exhibitProblems.length > 0 && (
          <ul role="alert" className="mt-2 list-disc pl-5 text-xs text-gold">
            {exhibitProblems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        <div className="mt-3 rounded-lg border border-line p-4 text-sm">
          {f.question || f.vignette ? (
            <QuestionPreview q={{ ...f, options: [f.a, f.b, f.c] }} />
          ) : (
            <p className="text-muted">Type the question to see it here.</p>
          )}
        </div>
      </section>
    </div>
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
