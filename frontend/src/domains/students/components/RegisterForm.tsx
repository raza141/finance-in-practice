"use client";

import { useState, type FormEvent } from "react";

import { ApiError } from "@/core/http/ApiError";

import { RegistrationContract } from "../services/RegistrationContract";
import { StudentApiClient } from "../services/StudentApiClient";

const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const client = new StudentApiClient();
const { OTHER, EXTRA, LIMITS } = RegistrationContract;

/** Public sign-up: a request the owner approves in admin before the student can sign in. `courses` = published titles only. */
export function RegisterForm({ courses }: { courses: string[] }) {
  const [course, setCourse] = useState("");
  const [state, setState] = useState<{ kind: "editing"; error?: string } | { kind: "sending" } | { kind: "done"; message: string }>({ kind: "editing" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v)]));
    setState({ kind: "sending" });
    try {
      const { message } = await client.register(fields);
      setState({ kind: "done", message });
    } catch (error) {
      setState({ kind: "editing", error: error instanceof ApiError ? error.message : "Something went wrong. Please retry." });
    }
  }

  if (state.kind === "done") {
    return (
      <div role="status" className="rounded-2xl border border-quant/40 bg-quant/5 p-5">
        <p className="font-semibold text-ink">You&rsquo;re registered</p>
        <p className="mt-1 text-sm text-muted">{state.message} Once you&rsquo;re confirmed, sign in here with Google to book your sessions.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={state.kind === "sending"} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className={LABEL}>Full name</span>
          <input name="name" required autoComplete="name" minLength={LIMITS.name[0]} maxLength={LIMITS.name[1]} className={FIELD} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Email</span>
          <input name="email" type="email" required autoComplete="email" maxLength={LIMITS.email} className={FIELD} />
          <span className="text-xs text-muted">Use your Google / Gmail address: that&rsquo;s how you&rsquo;ll sign in.</span>
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Mobile (WhatsApp)</span>
          <input name="phone" type="tel" required autoComplete="tel" maxLength={LIMITS.phone[1]} placeholder="+971 50 123 4567" className={FIELD} />
        </label>
        <label className="grid gap-1.5">
          <span className={LABEL}>Course</span>
          <select name="course" required value={course} onChange={(e) => setCourse(e.target.value)} className={FIELD}>
            <option value="" disabled>
              Choose a course
            </option>
            <optgroup label="Exam courses">
              {courses.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            <optgroup label="Consultancy">
              {EXTRA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
            <optgroup label="Anything else">
              <option value={OTHER}>School, university or other subject</option>
            </optgroup>
          </select>
        </label>
        {course === OTHER && (
          <label className="grid gap-1.5">
            <span className={LABEL}>What would you like to study?</span>
            <input name="topic" required minLength={LIMITS.topic[0]} maxLength={LIMITS.topic[1]} placeholder="e.g. AP Statistics, corporate finance" className={FIELD} />
          </label>
        )}
        {/* Honeypot: hidden from people, filled by bots. */}
        <input name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      </fieldset>
      {state.kind === "editing" && state.error && (
        <p role="alert" className="text-sm text-gold">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="inline-flex h-11 items-center justify-center rounded-md bg-gold px-6 font-mono text-sm font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:opacity-50"
      >
        {state.kind === "sending" ? "Registering…" : "Register"}
      </button>
      <p className="text-xs text-muted">We only use these details to arrange your lessons.</p>
    </form>
  );
}
