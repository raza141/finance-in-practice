"use client";

import { useMemo, useState, type ReactNode } from "react";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import type { Recipient } from "../types";

/** Most students one send may reach (the server refuses more). */
const MAX = 300;
/** Above this many students, Send asks for a second click. */
const CONFIRM_ABOVE = 5;
/** The gateway waits 3–8 s between messages. */
const SECONDS_EACH = 5.5;

const CHIP = "rounded-full border px-3 py-1 text-xs transition-colors";
const chip = (active: boolean) => `${CHIP} ${active ? "border-quant bg-quant/10 text-quant" : "border-line text-muted hover:border-quant/50"}`;
const BUTTON = "h-10 w-fit rounded-md px-4 text-sm font-semibold";

type Filter = { by: "course" | "batch"; value: string } | null;

/**
 * Pick students and send. Search by name, narrow to a course or a batch, "Select all shown", and Send:
 * above 5 students it asks once more with the count. Students ticked stay ticked when the filter changes.
 * With `fixed` (a client page) there is no picker. With `starters` there is a message box that each starter
 * fills. `batch` is a fresh id per page view: a double click queues nothing twice.
 */
export function Composer({
  students = [],
  fixed,
  batch,
  action,
  back,
  starters,
  children,
}: {
  students?: readonly Recipient[];
  fixed?: { id: string; name: string };
  batch: string;
  action: (formData: FormData) => Promise<void>;
  back?: string;
  starters?: readonly { label: string; text: string }[];
  children?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(null);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [armed, setArmed] = useState(false);
  const [text, setText] = useState(starters?.[0]?.text ?? "");

  const courses = useMemo(() => [...new Set(students.flatMap((s) => s.courses))].sort(), [students]);
  const batches = useMemo(() => [...new Set(students.flatMap((s) => s.batches))].sort(), [students]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return students.filter(
      (s) =>
        (!q || s.name.toLowerCase().includes(q)) && (!filter || (filter.by === "course" ? s.courses : s.batches).includes(filter.value)),
    );
  }, [students, query, filter]);

  const change = (next: ReadonlySet<string>) => {
    setSelected(next);
    setArmed(false);
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    change(next);
  };
  const count = fixed ? 1 : selected.size;
  const minutes = Math.max(1, Math.ceil((count * SECONDS_EACH) / 60));
  const needsConfirm = count > CONFIRM_ABOVE && !armed;

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="batch" value={batch} />
      {back && <input type="hidden" name="back" value={back} />}
      {fixed ? (
        <input type="hidden" name="clientId" value={fixed.id} />
      ) : (
        <fieldset className="grid gap-3 rounded-md border border-line p-3">
          <legend className="px-1 text-xs text-muted">Send to</legend>
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="clientId" value={id} />
          ))}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
            placeholder="Search a student by name"
            aria-label="Search students"
            className={FIELD}
          />
          {(courses.length > 0 || batches.length > 0) && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by course or batch">
              <button type="button" onClick={() => setFilter(null)} className={chip(filter === null)} aria-pressed={filter === null}>
                Everyone
              </button>
              {courses.map((c) => {
                const on = filter?.by === "course" && filter.value === c;
                return (
                  <button key={`c:${c}`} type="button" onClick={() => setFilter(on ? null : { by: "course", value: c })} className={chip(on)} aria-pressed={on}>
                    {c}
                  </button>
                );
              })}
              {batches.map((b) => {
                const on = filter?.by === "batch" && filter.value === b;
                return (
                  <button key={`b:${b}`} type="button" onClick={() => setFilter(on ? null : { by: "batch", value: b })} className={chip(on)} aria-pressed={on}>
                    {b}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => change(new Set([...selected, ...shown.map((s) => s.id)]))}
              disabled={shown.length === 0}
              className="text-quant hover:underline disabled:opacity-50"
            >
              Select all shown ({shown.length})
            </button>
            <button type="button" onClick={() => change(new Set())} disabled={selected.size === 0} className="text-muted hover:underline disabled:opacity-50">
              Clear
            </button>
            <span className="ml-auto text-muted" aria-live="polite">
              {selected.size} selected
            </span>
          </div>
          <ul className="grid max-h-64 gap-1 overflow-y-auto text-sm sm:grid-cols-2">
            {shown.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5">
                  <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} className="accent-[var(--color-quant)]" />
                  <span>{s.name}</span>
                  {s.courses.length > 0 && <span className="truncate text-xs text-muted">{s.courses.join(", ")}</span>}
                </label>
              </li>
            ))}
            {shown.length === 0 && <li className="text-muted">No student matches.</li>}
          </ul>
        </fieldset>
      )}

      {children}

      {starters && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Start from">
            <span className="text-xs text-muted">Start from:</span>
            {starters.map((s) => (
              <button key={s.label} type="button" onClick={() => setText(s.text)} className={chip(text === s.text)}>
                {s.label}
              </button>
            ))}
          </div>
          <label className="grid gap-1 text-sm">
            Message
            <textarea
              name="message"
              required
              rows={9}
              maxLength={3000}
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`${FIELD} resize-y`}
            />
          </label>
          <p className="text-xs text-muted">
            {"{firstName}"} becomes each student&rsquo;s first name. Goes out at any hour, a few seconds apart. A newly joined student gets the
            &ldquo;save this number&rdquo; message first.
          </p>
        </div>
      )}

      {count > MAX ? (
        <p className="text-sm text-gold">Up to {MAX} students per send: narrow the filter.</p>
      ) : needsConfirm ? (
        <button type="button" onClick={() => setArmed(true)} className={`${BUTTON} bg-quant text-canvas hover:bg-quant/90`}>
          Send to {count} students
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <PendingButton pendingLabel="Sending…" className={`${BUTTON} ${armed ? "bg-gold" : "bg-quant"} text-canvas hover:opacity-90`}>
            {fixed ? `Send to ${fixed.name}` : armed ? `Confirm: send to ${count} (about ${minutes} min)` : `Send to ${count} ${count === 1 ? "student" : "students"}`}
          </PendingButton>
          {armed && (
            <button type="button" onClick={() => setArmed(false)} className="text-sm text-muted hover:underline">
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  );
}
