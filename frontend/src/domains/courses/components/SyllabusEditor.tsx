"use client";

import { useState } from "react";

import type { SyllabusModule } from "../types";

interface DraftModule {
  key: number;
  title: string;
  summary: string;
  /** One topic per line, kept as typed so blank lines don't vanish mid-edit. */
  topics: string;
}

const FIELD =
  "w-full rounded-md border border-line bg-canvas/70 px-3 py-2 text-sm text-ink outline-none focus:border-quant/70";
const SMALL_BUTTON = "rounded px-2 py-1 text-xs text-muted transition-colors hover:bg-surface-raised hover:text-ink disabled:opacity-30";

let nextKey = 0;
const draft = (module?: SyllabusModule): DraftModule => ({
  key: nextKey++,
  title: module?.title ?? "",
  summary: module?.summary ?? "",
  topics: module?.topics.join("\n") ?? "",
});

const serialise = (modules: DraftModule[]): SyllabusModule[] =>
  modules.map((m) => ({
    title: m.title.trim(),
    ...(m.summary.trim() ? { summary: m.summary.trim() } : {}),
    topics: m.topics.split("\n").map((t) => t.trim()).filter(Boolean),
  }));

/** Ordered list of curriculum modules; submits as JSON in a hidden `syllabus` field. */
export function SyllabusEditor({ initial, disabled }: { initial: readonly SyllabusModule[]; disabled?: boolean }) {
  const [modules, setModules] = useState<DraftModule[]>(() => initial.map((m) => draft(m)));

  const update = (key: number, patch: Partial<DraftModule>) =>
    setModules((list) => list.map((m) => (m.key === key ? { ...m, ...patch } : m)));
  const move = (index: number, by: -1 | 1) =>
    setModules((list) => {
      const next = [...list];
      [next[index], next[index + by]] = [next[index + by], next[index]];
      return next;
    });

  return (
    <div>
      <input type="hidden" name="syllabus" value={JSON.stringify(serialise(modules))} />
      {modules.length === 0 && (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No modules yet. The public page will say the curriculum is shared on the call.
        </p>
      )}
      <ol className="grid gap-4">
        {modules.map((module, index) => (
          <li key={module.key} className="rounded-lg border border-line bg-canvas/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-quant">Module {String(index + 1).padStart(2, "0")}</span>
              <div className="flex gap-1">
                <button type="button" className={SMALL_BUTTON} disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Move module ${index + 1} up`}>
                  ↑
                </button>
                <button type="button" className={SMALL_BUTTON} disabled={disabled || index === modules.length - 1} onClick={() => move(index, 1)} aria-label={`Move module ${index + 1} down`}>
                  ↓
                </button>
                <button type="button" className={`${SMALL_BUTTON} hover:text-red-400`} disabled={disabled} onClick={() => setModules((list) => list.filter((m) => m.key !== module.key))}>
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-3 grid gap-3">
              <input
                aria-label={`Module ${index + 1} title`}
                placeholder="Module title, e.g. Duration and convexity"
                required
                maxLength={160}
                value={module.title}
                disabled={disabled}
                onChange={(e) => update(module.key, { title: e.target.value })}
                className={FIELD}
              />
              <input
                aria-label={`Module ${index + 1} summary`}
                placeholder="One-line summary (optional)"
                maxLength={600}
                value={module.summary}
                disabled={disabled}
                onChange={(e) => update(module.key, { summary: e.target.value })}
                className={FIELD}
              />
              <textarea
                aria-label={`Module ${index + 1} topics, one per line`}
                placeholder={"Topics, one per line\nMacaulay duration\nConvexity adjustment"}
                rows={Math.max(3, module.topics.split("\n").length)}
                value={module.topics}
                disabled={disabled}
                onChange={(e) => update(module.key, { topics: e.target.value })}
                className={`${FIELD} resize-y leading-relaxed`}
              />
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        disabled={disabled || modules.length >= 30}
        onClick={() => setModules((list) => [...list, draft()])}
        className="mt-4 h-9 rounded-md border border-quant/50 px-4 text-sm text-quant transition-colors hover:bg-quant/10 disabled:opacity-40"
      >
        + Add module
      </button>
    </div>
  );
}
