"use client";

import { useRef, useState, useTransition } from "react";

import { practisePlanTopic } from "@/domains/mocks/actions/mocks";

import { moveStudyTopic, setStudyTopicDone } from "../actions/myPlan";
import { StudyDays, type StudyDayItem, type StudyTopic } from "../services/StudyDays";
import { BUTTON } from "./buttons";
import { TabButton } from "./StudentPortal";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SHOWN = 3;
const fmt = (date: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", ...options }).format(new Date(`${date}T00:00:00Z`));
const longDay = (date: string) => fmt(date, { weekday: "long", day: "numeric", month: "long" });

const CHIP: Record<StudyDayItem["kind"], string> = {
  topic: "border-line bg-surface text-ink",
  session: "border-quant/40 bg-quant/10 text-quant",
  mock: "border-line bg-canvas text-muted",
  exam: "border-gold bg-gold text-canvas font-semibold",
};

function chipClass(item: StudyDayItem): string {
  if (item.kind !== "topic") return CHIP[item.kind];
  if (item.carried) return "border-amber-400/60 bg-amber-400/10 text-amber-200";
  if (item.status === "done") return "border-line bg-surface text-muted line-through";
  if (item.status === "skipped") return "border-line bg-surface text-muted/60 line-through";
  return CHIP.topic;
}

function label(item: StudyDayItem): string {
  switch (item.kind) {
    case "topic":
      return item.topic;
    case "session":
      return `${item.time} · Session`;
    case "mock":
      return `${item.percent}% · ${item.title}`;
    case "exam":
      return `Exam · ${item.course}`;
  }
}

/**
 * The study plan as a calendar (Notion-like): topics, sessions, finished mocks and exam day on their days.
 * A month on wide screens, a day-by-day agenda on phones. Drag a topic to another day, or tap anything for its details.
 * Overdue topics sit on today, in amber, until they're moved or done. `readOnly`: admin view-as, nothing changes.
 */
export function StudyCalendar({
  days: initialDays,
  unscheduled,
  today,
  last,
  readOnly,
}: {
  days: Record<string, StudyDayItem[]>;
  unscheduled: StudyTopic[];
  today: string;
  /** The last day a topic can move to: exam day, or a year ahead. */
  last: string;
  readOnly: boolean;
}) {
  const [days, setDays] = useState(initialDays);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [open, setOpen] = useState<{ item: StudyDayItem } | { day: string } | null>(null);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);

  const show = (next: { item: StudyDayItem } | { day: string }) => {
    setOpen(next);
    setError("");
    if (!dialog.current?.open) dialog.current?.showModal();
  };
  const movable = (item: StudyDayItem): item is StudyTopic => !readOnly && item.kind === "topic" && item.status !== "skipped";
  const canDrop = (day: string) => day >= today && day <= last;

  /** Moves the topic on screen at once; puts it back if the server says no. */
  const move = (topic: StudyTopic, day: string) => {
    if (!canDrop(day) || day === topic.date) return;
    const before = days;
    const moved: StudyTopic = { ...topic, date: day, dueOn: day, carried: false };
    setDays((d) => {
      const next = { ...d, [topic.date]: (d[topic.date] ?? []).filter((x) => x.id !== topic.id) };
      next[day] = [...(next[day] ?? []), moved];
      return next;
    });
    if (open && "item" in open) setOpen({ item: moved });
    startTransition(async () => {
      const { ok } = await moveStudyTopic(topic.id, day).catch(() => ({ ok: false }));
      if (!ok) {
        setDays(before);
        setError("Couldn't move it. Please try again.");
      }
    });
  };

  const tick = (topic: StudyTopic, done: boolean) => {
    const before = days;
    const updated: StudyTopic = { ...topic, status: done ? "done" : "planned", carried: done ? false : topic.carried };
    setDays((d) => ({ ...d, [topic.date]: (d[topic.date] ?? []).map((x) => (x.id === topic.id ? updated : x)) }));
    setOpen({ item: updated });
    startTransition(async () => {
      const { ok } = await setStudyTopicDone(topic.id, done).catch(() => ({ ok: false }));
      if (!ok) {
        setDays(before);
        setError("Couldn't save that. Please try again.");
      }
    });
  };

  const agenda = Object.keys(days)
    .filter((d) => d >= today && days[d].length > 0)
    .sort();

  return (
    <div className="grid gap-4">
      {unscheduled.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted">Unscheduled</span>
          {unscheduled.map((u) => (
            <button key={u.id} type="button" onClick={() => show({ item: u })} className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs text-ink">
              {u.topic}
            </button>
          ))}
        </div>
      )}

      {/* Wide screens: the month. */}
      <div className="hidden md:block">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-semibold">{fmt(`${month}-01`, { month: "long", year: "numeric" })}</p>
          <div className="flex gap-1">
            <button type="button" aria-label="Previous month" onClick={() => setMonth((m) => StudyDays.shiftMonth(m, -1))} className="h-8 w-8 rounded-md border border-line text-muted hover:text-ink">
              ‹
            </button>
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="h-8 rounded-md border border-line px-2.5 text-xs text-muted hover:text-ink">
              Today
            </button>
            <button type="button" aria-label="Next month" onClick={() => setMonth((m) => StudyDays.shiftMonth(m, 1))} className="h-8 w-8 rounded-md border border-line text-muted hover:text-ink">
              ›
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-line bg-line gap-px">
          {WEEKDAYS.map((w) => (
            <div key={w} className="bg-canvas px-2 py-1.5 text-[11px] text-muted">
              {w}
            </div>
          ))}
          {StudyDays.monthGrid(month)
            .flat()
            .map((day) => {
              const list = days[day] ?? [];
              const inMonth = day.slice(0, 7) === month;
              return (
                <div
                  key={day}
                  onDragOver={(e) => canDrop(day) && !readOnly && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const [from, id] = e.dataTransfer.getData("text/plain").split("|");
                    const topic = days[from]?.find((x): x is StudyTopic => x.kind === "topic" && x.id === id);
                    if (topic) move(topic, day);
                  }}
                  className={`grid min-h-24 content-start gap-1 p-1.5 ${inMonth ? "bg-canvas" : "bg-canvas/50"}`}
                >
                  <span className={`justify-self-start text-[11px] ${day === today ? "rounded-full bg-quant px-1.5 font-semibold text-canvas" : inMonth ? "text-muted" : "text-muted/40"}`}>
                    {Number(day.slice(8))}
                  </span>
                  {list.slice(0, SHOWN).map((item) => (
                    <Chip key={`${item.kind}-${item.id}`} item={item} draggable={movable(item)} onOpen={() => show({ item })} />
                  ))}
                  {list.length > SHOWN && (
                    <button type="button" onClick={() => show({ day })} className="text-left text-[11px] text-muted hover:text-ink">
                      +{list.length - SHOWN} more
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Phones: from today, day by day. */}
      <ol className="grid gap-4 md:hidden">
        {agenda.length === 0 && <li className="text-sm text-muted">Nothing planned from today.</li>}
        {agenda.map((day) => (
          <li key={day}>
            <p className={`text-xs ${day === today ? "font-semibold text-quant" : "text-muted"}`}>{day === today ? "Today" : longDay(day)}</p>
            <div className="mt-1.5 grid gap-1.5">
              {days[day].map((item) => (
                <button key={`${item.kind}-${item.id}`} type="button" onClick={() => show({ item })} className={`rounded-lg border px-3 py-2 text-left text-sm ${chipClass(item)}`}>
                  {label(item)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <dialog
        ref={dialog}
        onClose={() => setOpen(null)}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-line bg-canvas p-0 text-ink backdrop:bg-black/60"
      >
        {open && (
          <div className="grid gap-4 p-5">
            {"day" in open ? (
              <>
                <h3 className="font-semibold">{longDay(open.day)}</h3>
                <div className="grid gap-1.5">
                  {(days[open.day] ?? []).map((item) => (
                    <button key={`${item.kind}-${item.id}`} type="button" onClick={() => show({ item })} className={`rounded-lg border px-3 py-2 text-left text-sm ${chipClass(item)}`}>
                      {label(item)}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <Details key={`${open.item.kind}-${open.item.id}`} item={open.item} today={today} last={last} readOnly={readOnly} onMove={move} onTick={tick} />
            )}
            {error && (
              <p role="alert" className="text-sm text-red-300">
                {error}
              </p>
            )}
            <button type="button" onClick={() => dialog.current?.close()} className="justify-self-end text-sm text-muted hover:text-ink">
              Close
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Chip({ item, draggable, onOpen }: { item: StudyDayItem; draggable: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={(e) => e.dataTransfer.setData("text/plain", `${item.date}|${item.id}`)}
      onClick={onOpen}
      className={`block w-full truncate rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight ${chipClass(item)} ${draggable ? "cursor-grab" : ""}`}
    >
      {label(item)}
    </button>
  );
}

/** What one item is, and what can be done with it (topics only, and never in view-as). */
function Details({
  item,
  today,
  last,
  readOnly,
  onMove,
  onTick,
}: {
  item: StudyDayItem;
  today: string;
  last: string;
  readOnly: boolean;
  onMove: (topic: StudyTopic, day: string) => void;
  onTick: (topic: StudyTopic, done: boolean) => void;
}) {
  const [to, setTo] = useState(item.kind === "topic" && item.dueOn >= today ? item.dueOn : today);
  switch (item.kind) {
    case "session":
      return (
        <div className="grid gap-1">
          <h3 className="font-semibold">Session · {item.course}</h3>
          <p className="text-sm text-muted">
            {longDay(item.date)}, {item.time} · {item.place}
            {item.pending && " · waiting for approval"}
          </p>
          {item.meetingUrl && (
            <a href={item.meetingUrl} target="_blank" rel="noreferrer" className={`${BUTTON} mt-2 justify-self-start`}>
              Join
            </a>
          )}
        </div>
      );
    case "mock":
      return (
        <div className="grid gap-1">
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-sm text-muted">
            {longDay(item.date)} · {item.percent}%
          </p>
          <a href={`/student/mocks/${item.id}`} className={`${BUTTON} mt-2 justify-self-start`}>
            Review
          </a>
        </div>
      );
    case "exam":
      return (
        <div className="grid gap-1">
          <h3 className="font-semibold text-gold">Exam · {item.course}</h3>
          <p className="text-sm text-muted">
            {longDay(item.date)} · {item.days === 0 ? "today" : `in ${item.days} days`}
          </p>
        </div>
      );
    case "topic":
      return (
        <div className="grid gap-3">
          <div>
            <h3 className="font-semibold">{item.topic}</h3>
            <p className={`text-sm ${item.carried ? "text-amber-300" : "text-muted"}`}>
              {item.dueOn ? (item.carried ? `Was due ${longDay(item.dueOn)}` : longDay(item.dueOn)) : "Not scheduled yet"}
            </p>
            {item.note && <p className="mt-2 text-sm text-ink/80">{item.note}</p>}
          </div>
          {!readOnly && item.status !== "skipped" && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={item.status === "done"} onChange={(e) => onTick(item, e.target.checked)} className="h-4 w-4 accent-[var(--color-quant)]" />
                Done
              </label>
              {item.status === "planned" && (
                <div className="flex items-center gap-2">
                  <input type="date" value={to} min={today} max={last} onChange={(e) => setTo(e.target.value)} aria-label="Move to" className="h-9 rounded-md border border-line bg-surface px-2 text-sm" />
                  <button type="button" onClick={() => onMove(item, to)} disabled={!to || to === item.dueOn} className={BUTTON}>
                    Move
                  </button>
                </div>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {item.materialUrl && (
              <a href={item.materialUrl} target="_blank" rel="noreferrer" className={BUTTON}>
                Material
              </a>
            )}
            {!readOnly && item.test && item.status === "planned" && (
              <form action={practisePlanTopic}>
                <input type="hidden" name="topic" value={item.topic} />
                <button type="submit" className={BUTTON}>
                  Topic test
                </button>
              </form>
            )}
            {!readOnly && item.status === "planned" && (
              <TabButton tab="book" notes={`Session on: ${item.topic}`} className={BUTTON}>
                Book a session
              </TabButton>
            )}
          </div>
        </div>
      );
  }
}
