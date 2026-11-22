"use client";

import { startTransition, useActionState, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { BUTTON, JOIN_BUTTON } from "@/domains/students/components/buttons";

import { logStudyTime, saveStudyGoal } from "../actions/study";
import { StudyGoalContract } from "../services/StudyGoalContract";
import type { FormResult, GoalOption, StudyKind } from "../types";

const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
// Same height whatever the control, 44px for thumbs.
const INPUT = "mt-1.5 block h-11 w-full min-w-0 rounded-lg border border-line bg-surface-raised px-3 text-base text-ink disabled:opacity-60 sm:text-sm";
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const KIND: Record<StudyKind, string> = { reading: "Reading", video: "Video", other: "Other" };
const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];

const never = () => () => {};
let zones: string[] | undefined;
const browserZones = () => (zones ??= [...new Set([ZonedCalendar.visitorTimeZone(), ...Intl.supportedValuesOf("timeZone")])]);
const NO_ZONES: string[] = [];

function Labelled({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function Status({ result }: { result: FormResult }) {
  return (
    <p role="status" className={`text-sm empty:hidden ${result && !result.ok ? "text-red-300" : "text-emerald-300"}`}>
      {result?.message}
    </p>
  );
}

/** Submitted by hand: a form `action` would wipe what they typed when the server refuses it. */
const submit = (send: (data: FormData) => void) => (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  startTransition(() => send(data));
};

export interface GoalDefaults {
  course: string;
  examOn: string | null;
  startedOn: string;
  targetHours: number;
  hoursPerDay: number;
  priorHours: number;
  studyDays: number[];
  timeZone: string;
}

/** F1's onboarding, and editing it later. The time zone starts at the browser's. */
export function StudyGoalForm({ options, saved, today, readOnly }: { options: GoalOption[]; saved: GoalDefaults | null; today: string; readOnly: boolean }) {
  const [result, send, busy] = useActionState(saveStudyGoal, null);
  const [course, setCourse] = useState(saved?.course ?? options[0].course);
  const [pickedZone, setPickedZone] = useState(saved?.timeZone ?? "");
  const allZones = useSyncExternalStore(never, browserZones, () => NO_ZONES);
  const zone = pickedZone || allZones[0] || "Asia/Dubai";
  const batchExam = options.find((o) => o.course === course)?.examOn ?? null;

  return (
    <form action={send} onSubmit={submit(send)}>
      <fieldset disabled={readOnly || busy} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
        <Labelled label="CFA level">
          <select name="course" value={course} onChange={(e) => setCourse(e.target.value)} className={INPUT}>
            {options.map((o) => (
              <option key={o.course} value={o.course}>
                {o.course}
              </option>
            ))}
          </select>
        </Labelled>
        {batchExam ? (
          <Labelled label="Exam date">
            <input key="batch" type="date" value={batchExam} disabled readOnly className={INPUT} />
          </Labelled>
        ) : (
          <Labelled label="Exam date">
            <input key="typed" name="examOn" type="date" required min={ZonedCalendar.addDays(today, 1)} defaultValue={saved?.examOn ?? ""} className={INPUT} />
          </Labelled>
        )}
        <Labelled label="Started studying">
          {/* A day's slack: the browser's today can be ahead of the server's guess. The action checks it exactly. */}
          <input name="startedOn" type="date" required max={ZonedCalendar.addDays(today, 1)} defaultValue={saved?.startedOn ?? today} className={INPUT} />
        </Labelled>
        <Labelled label="Hours studied elsewhere">
          <input name="priorHours" type="number" inputMode="decimal" min={0} max={2000} step="any" defaultValue={saved?.priorHours ?? 0} className={INPUT} />
        </Labelled>
        <Labelled label="Target hours">
          <input name="targetHours" type="number" inputMode="numeric" required min={20} max={2000} defaultValue={saved?.targetHours ?? StudyGoalContract.DEFAULT_TARGET} className={INPUT} />
        </Labelled>
        <Labelled label="Hours a day">
          <input name="hoursPerDay" type="number" inputMode="decimal" required min={0.5} max={16} step={0.1} defaultValue={saved?.hoursPerDay ?? 2} className={INPUT} />
        </Labelled>
        <fieldset className="min-w-0 sm:col-span-2">
          <legend className={LABEL}>Study days</legend>
          <div className="mt-1.5 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {ALL_DAYS.map((day) => (
              <label
                key={day}
                className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-line text-sm text-muted has-checked:border-quant has-checked:text-quant has-focus-visible:outline-2 has-focus-visible:outline-quant"
              >
                <input type="checkbox" name="studyDays" value={day} defaultChecked={(saved?.studyDays ?? ALL_DAYS).includes(day)} className="accent-quant" />
                {WEEKDAYS[day - 1]}
              </label>
            ))}
          </div>
        </fieldset>
        <Labelled label="Time zone" className="sm:col-span-2">
          <select name="timeZone" value={zone} onChange={(e) => setPickedZone(e.target.value)} className={INPUT}>
            {(allZones.includes(zone) ? allZones : [zone, ...allZones]).map((z) => (
              <option key={z} value={z}>
                {z.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Labelled>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" className={`${saved ? BUTTON : JOIN_BUTTON} min-h-11 disabled:opacity-50`}>
            {busy ? "Saving…" : saved ? "Save" : "Set my study goal"}
          </button>
          <Status result={result} />
        </div>
      </fieldset>
    </form>
  );
}

/** Reading or video done away from the portal. */
export function StudyLogForm({ today, readOnly }: { today: string; readOnly: boolean }) {
  const [result, send, busy] = useActionState(logStudyTime, null);
  return (
    <form action={send} onSubmit={submit(send)}>
      <fieldset disabled={readOnly || busy} className="grid min-w-0 grid-cols-2 items-end gap-3 sm:grid-cols-4">
        <Labelled label="Day">
          <select name="date" defaultValue={today} key={today} className={INPUT}>
            <option value={today}>Today</option>
            <option value={ZonedCalendar.addDays(today, -1)}>Yesterday</option>
          </select>
        </Labelled>
        <Labelled label="Minutes">
          <input name="minutes" type="number" inputMode="numeric" required min={1} max={StudyGoalContract.MAX_LOG_MINUTES} defaultValue={45} className={INPUT} />
        </Labelled>
        <Labelled label="Type">
          <select name="kind" defaultValue="reading" className={INPUT}>
            {StudyGoalContract.KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {KIND[kind]}
              </option>
            ))}
          </select>
        </Labelled>
        <button type="submit" className={`${BUTTON} h-11 disabled:opacity-50`}>
          {busy ? "Saving…" : "Log"}
        </button>
        <div className="col-span-full">
          <Status result={result} />
        </div>
      </fieldset>
    </form>
  );
}
