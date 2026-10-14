"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { ApiError } from "@/core/http/ApiError";

import { RegistrationContract } from "../services/RegistrationContract";
import { StudentApiClient } from "../services/StudentApiClient";

const FIELD =
  "w-full rounded-md border border-line bg-canvas/80 px-3 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-quant/70 disabled:opacity-60";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const client = new StudentApiClient();
const { OTHER, EXTRA, LIMITS } = RegistrationContract;

/** "Finish joining" after Google sign-in: enrols at once and opens the portal. `courses` = published titles only. */
export function JoinForm({ courses, email }: { courses: string[]; email: string }) {
  const router = useRouter();
  const [course, setCourse] = useState("");
  const [state, setState] = useState<{ kind: "editing"; error?: string } | { kind: "sending" }>({ kind: "editing" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = Object.fromEntries([...new FormData(event.currentTarget)].map(([k, v]) => [k, String(v)]));
    setState({ kind: "sending" });
    try {
      await client.join(fields);
      // The session cookie is set: /student now renders the signed-in portal.
      router.replace("/student");
      router.refresh();
    } catch (error) {
      setState({ kind: "editing", error: error instanceof ApiError ? error.message : "Something went wrong. Please retry." });
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <fieldset disabled={state.kind === "sending"} className="grid gap-4">
        <label className="grid gap-1.5">
          <span className={LABEL}>Full name</span>
          <input name="name" required autoComplete="name" minLength={LIMITS.name[0]} maxLength={LIMITS.name[1]} className={FIELD} />
        </label>
        <div className="grid gap-1.5">
          <span className={LABEL}>Google account</span>
          <p className="flex items-center gap-2 rounded-md border border-quant/30 bg-quant/5 px-3 py-2.5 text-sm text-ink">
            <span aria-hidden className="text-quant">✓</span>
            {email}
          </p>
        </div>
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
        {state.kind === "sending" ? "Opening your portal…" : "Join and open my portal"}
      </button>
      <p className="text-xs text-muted">We only use these details to arrange your lessons.</p>
    </form>
  );
}
