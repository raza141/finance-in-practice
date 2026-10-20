"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { AnswerStore } from "../services/AnswerStore";
import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Difficulty, QuestionSummary } from "../types";
import { DifficultyMeter } from "./DifficultyMeter";

export type BankFilters = { level: string; topic: string; difficulty: string };
type Result = "right" | "wrong" | "answered";

/**
 * The Question Bank: filters run in the browser (instant, no reload) and are
 * mirrored into the URL so a filtered view can be shared or posted. Progress is
 * what AnswerPicker saved in this browser; nothing leaves the device.
 */
export function QuestionBank({ questions, today, initial }: { questions: QuestionSummary[]; today: QuestionSummary | null; initial: BankFilters }) {
  const [filters, setFilters] = useState<BankFilters>(initial);
  const [query, setQuery] = useState("");
  const [hideAnswered, setHideAnswered] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});

  useEffect(() => {
    const found: Record<string, Result> = {};
    try {
      for (const q of questions) {
        const r = AnswerStore.result(`fip-cfa-q:${q.code}`);
        if (r) found[q.code] = r;
      }
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading this browser's saved answers after hydration
    setResults(found);
  }, [questions]);

  const set = (name: keyof BankFilters, value: string) => {
    const next = { ...filters, [name]: filters[name] === value ? "" : value };
    setFilters(next);
    const params = new URLSearchParams(Object.entries(next).filter(([, v]) => v));
    window.history.replaceState(null, "", params.toString() ? `?${params}` : window.location.pathname);
  };
  const clear = () => {
    setFilters({ level: "", topic: "", difficulty: "" });
    setQuery("");
    setHideAnswered(false);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const needle = query.trim().toLowerCase();
  const match = (q: QuestionSummary, skip?: keyof BankFilters) =>
    (skip === "level" || !filters.level || String(q.level) === filters.level) &&
    (skip === "topic" || !filters.topic || q.topic === filters.topic) &&
    (skip === "difficulty" || !filters.difficulty || q.difficulty === filters.difficulty) &&
    (!needle || q.title.toLowerCase().includes(needle)) &&
    (!hideAnswered || !results[q.code]);
  const count = (skip: keyof BankFilters, key: (q: QuestionSummary) => string) => {
    const c: Record<string, number> = {};
    for (const q of questions) if (match(q, skip)) c[key(q)] = (c[key(q)] ?? 0) + 1;
    return c;
  };

  const shown = questions.filter((q) => match(q));
  const groups = QuestionTaxonomy.TOPICS.map((t) => ({
    ...t,
    questions: shown.filter((q) => q.topic === t.slug),
  })).filter((g) => g.questions.length > 0);
  const answered = questions.filter((q) => results[q.code]).length;
  const right = questions.filter((q) => results[q.code] === "right").length;
  const wrong = questions.filter((q) => results[q.code] === "wrong").length;
  const active = [filters.level, filters.topic, filters.difficulty, needle, hideAnswered].filter(Boolean).length;

  const levelCounts = count("level", (q) => String(q.level));
  const difficultyCounts = count("difficulty", (q) => q.difficulty);
  const topicCounts = count("topic", (q) => q.topic);

  const panel = (
    <div className="space-y-7">
      <label className="block">
        <span className="text-sm font-semibold text-ink">Search</span>
        <input
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Duration, beta, NPV…"
          className="mt-2 h-11 w-full rounded-lg border border-line bg-canvas px-3 text-[15px] text-ink placeholder:text-muted/60 focus:border-quant focus:outline-none"
        />
      </label>

      <Group title="Level">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-canvas p-1">
          {QuestionTaxonomy.LEVELS.map((l) => (
            <Segment key={l} on={filters.level === String(l)} onClick={() => set("level", String(l))} empty={!levelCounts[l]}>
              <span className="font-serif text-base font-bold">{"I".repeat(l)}</span>
              <span className="text-[11px] text-muted tabular-nums">{levelCounts[l] ?? 0}</span>
            </Segment>
          ))}
        </div>
      </Group>

      <Group title="Difficulty">
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-canvas p-1">
          {QuestionTaxonomy.DIFFICULTIES.map((d: Difficulty) => (
            <Segment
              key={d}
              on={filters.difficulty === d}
              onClick={() => set("difficulty", d)}
              empty={!difficultyCounts[d]}
              title={QuestionTaxonomy.difficultyHint(d)}
            >
              <DifficultyMeter difficulty={d} />
              <span className="text-xs">{QuestionTaxonomy.difficultyLabel(d)}</span>
            </Segment>
          ))}
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          {filters.difficulty
            ? QuestionTaxonomy.difficultyHint(filters.difficulty as Difficulty)
            : "Easy is one step; hard takes several steps or hides an exam trap."}
        </p>
      </Group>

      <Group title="Topic">
        <ul className="-mx-2 space-y-0.5">
          {QuestionTaxonomy.TOPICS.map((t) => {
            const on = filters.topic === t.slug;
            const n = topicCounts[t.slug] ?? 0;
            return (
              <li key={t.slug}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("topic", t.slug)}
                  className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-quant ${on ? "bg-quant/15 text-quant" : n ? "text-ink/90 hover:bg-surface-raised" : "text-muted/50 hover:bg-surface-raised"}`}
                >
                  <span>{t.name}</span>
                  <span className="font-mono text-xs tabular-nums">{n}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Group>

      <label className="flex cursor-pointer items-center gap-3 text-sm text-ink/90">
        <input type="checkbox" checked={hideAnswered} onChange={(e) => setHideAnswered(e.target.checked)} className="size-4 accent-quant" />
        Hide questions I&rsquo;ve answered
      </label>

      {active > 0 && (
        <button type="button" onClick={clear} className="text-sm text-quant underline-offset-4 hover:underline">
          Clear all filters
        </button>
      )}
    </div>
  );

  return (
    <>
      {today && <TodayCard q={today} result={results[today.code]} />}

      <div className="mt-12 grid gap-10 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-14">
        <aside aria-label="Filters">
          <details className="group rounded-xl border border-line bg-surface/50 lg:hidden">
            <summary className="flex h-12 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold">
              <span>
                Filters
                {active > 0 && <span className="ml-2 rounded-full bg-quant/15 px-2 py-0.5 text-xs text-quant">{active} on</span>}
              </span>
              <span aria-hidden className="text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none">
                ⌄
              </span>
            </summary>
            <div className="border-t border-line p-4">{panel}</div>
          </details>
          <div className="hidden lg:sticky lg:top-28 lg:block">{panel}</div>
        </aside>

        <section aria-label="Questions">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-line pb-4">
            <p className="text-lg" aria-live="polite">
              <span className="font-semibold">{shown.length}</span> {shown.length === 1 ? "question" : "questions"}
              {active > 0 && <span className="text-muted"> match your filters</span>}
            </p>
            {answered > 0 && (
              <div className="min-w-48 text-sm text-muted">
                <p>
                  You&rsquo;ve answered {answered} of {questions.length}
                  {right + wrong > 0 && `, ${right} right`}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div
                    className="h-full rounded-full bg-emerald-400 transition-[width] duration-500"
                    style={{ width: `${(answered / questions.length) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {groups.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-lg">{questions.length ? "No questions match these filters." : "The first question is on its way."}</p>
              {active > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="mt-4 inline-flex h-11 items-center rounded-md border border-line px-5 text-sm hover:border-quant/60"
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            groups.map((g) => (
              <div key={g.slug} className="mt-8">
                <h2 className="flex items-baseline justify-between gap-4 text-xl font-bold">
                  {filters.topic ? (
                    g.name
                  ) : (
                    <button
                      type="button"
                      onClick={() => set("topic", g.slug)}
                      className="text-left hover:text-quant focus-visible:outline-2 focus-visible:outline-quant"
                    >
                      {g.name}
                    </button>
                  )}
                  <span className="text-sm font-normal text-muted">{g.questions.length}</span>
                </h2>
                <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface/40">
                  {g.questions.map((q) => (
                    <li key={q.code}>
                      <Row q={q} result={results[q.code]} />
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

function Segment({ on, empty, onClick, title, children }: { on: boolean; empty: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      title={title}
      className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-md px-1 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-quant ${on ? "bg-quant/15 text-quant shadow-[inset_0_0_0_1px] shadow-quant/60" : empty ? "text-muted/50 hover:bg-surface-raised" : "text-ink/90 hover:bg-surface-raised"}`}
    >
      {children}
    </button>
  );
}

const STATUS: Record<Result | "none", { label: string; mark: string; tone: string }> = {
  right: { label: "Answered correctly", mark: "✓", tone: "bg-emerald-400/15 text-emerald-300" },
  wrong: { label: "Answered, not quite", mark: "✕", tone: "bg-red-400/15 text-red-300" },
  answered: { label: "Answered", mark: "•", tone: "bg-quant/15 text-quant" },
  none: { label: "Not tried yet", mark: "", tone: "border-2 border-dashed border-line" },
};

function Status({ result }: { result?: Result }) {
  const s = STATUS[result ?? "none"];
  return (
    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-sm ${s.tone}`} title={s.label}>
      <span aria-hidden>{s.mark}</span>
      <span className="sr-only">{s.label}</span>
    </span>
  );
}

function Row({ q, result }: { q: QuestionSummary; result?: Result }) {
  return (
    <Link
      href={QuestionTaxonomy.path(q)}
      className="group flex items-center gap-4 px-4 py-4 transition-colors hover:bg-surface-raised focus-visible:bg-surface-raised focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-quant sm:px-5"
    >
      <Status result={result} />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink group-hover:text-quant">{q.title}</span>
        <span className="mt-0.5 block text-sm text-muted">{QuestionTaxonomy.levelLabel(q.level)}</span>
      </span>
      <span className="hidden text-sm text-muted sm:block">
        <DifficultyMeter difficulty={q.difficulty} label />
      </span>
      <span className="sm:hidden">
        <DifficultyMeter difficulty={q.difficulty} />
      </span>
    </Link>
  );
}

function TodayCard({ q, result }: { q: QuestionSummary; result?: Result }) {
  const topic = QuestionTaxonomy.topic(q.topic)?.name ?? q.topic;
  return (
    <section aria-labelledby="today-title" className="relative mt-10 overflow-hidden rounded-2xl border border-gold/40 bg-gold/5 p-6 sm:p-8">
      <p className="text-sm font-semibold text-gold">Today&rsquo;s question</p>
      <h2 id="today-title" className="mt-2 max-w-3xl font-serif text-2xl leading-snug font-bold sm:text-3xl">
        {q.title}
      </h2>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
        <span>{QuestionTaxonomy.levelLabel(q.level)}</span>
        <span>{topic}</span>
        <DifficultyMeter difficulty={q.difficulty} label />
      </p>
      <Link
        href="/cfa/question-of-the-day"
        className="mt-6 inline-flex h-12 items-center rounded-md bg-gold px-6 text-[15px] font-semibold text-canvas transition-colors hover:bg-gold-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {result ? "See your answer" : "Solve today's question"}
      </Link>
    </section>
  );
}
