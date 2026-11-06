import { Presentation } from "lucide-react";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { requestClassroom } from "../actions/classroom";
import { Batches } from "../services/Batches";
import { CLASSROOM_BUTTON } from "./buttons";
import type { PrivateClassroom, StudentClassroom } from "../types";

const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";

/** Inline chalkboard mark (no image request). */
function BoardIcon({ className = "" }: { className?: string }) {
  return (
    <Presentation aria-hidden strokeWidth={1.6} className={className} />
  );
}

const JOIN = `${CLASSROOM_BUTTON} mt-4`;

/** A class just for this student: the invite is there from the start. */
function OwnClassCard({ c }: { c: PrivateClassroom }) {
  return (
    <li className="relative overflow-hidden rounded-2xl border border-google-green-light/40 bg-[radial-gradient(circle_at_85%_0%,rgb(52_168_83/0.25),transparent_60%)] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-google-green/20">
          <BoardIcon className="h-7 w-7 text-google-green-light" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted uppercase">Google Classroom · just for you</p>
          <p className="truncate text-lg font-semibold text-ink">{c.title}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink/80">{c.note || "Your notes, homework and files from your instructor, in one private class."}</p>
      <a href={c.url} target="_blank" rel="noreferrer" className={JOIN}>
        Open my classroom
      </a>
    </li>
  );
}

/**
 * The portal's Classroom tab: private classes the owner added for this student
 * first, then one shared Classroom per course or batch (access approved per student).
 */
/** `readOnly`: an admin viewing as the student; Request access is shown but can't be sent. */
export function ClassroomPanel({ classes, own, email, readOnly = false }: { classes: StudentClassroom[]; own: PrivateClassroom[]; email: string; readOnly?: boolean }) {
  return (
    <section aria-labelledby="classroom-heading" className={CARD}>
        <h2 id="classroom-heading" className="text-2xl font-normal italic">
          Your classrooms
        </h2>
        {/* Every class side by side: private ones first (marked "just for you"), then the course classes. */}
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {own.map((c) => (
            <OwnClassCard key={c.id} c={c} />
          ))}
            {classes.map((c) => (
              <li
                key={c.title}
                className={`relative overflow-hidden rounded-2xl border p-5 ${
                  c.url ? "border-google-green-light/30 bg-[radial-gradient(circle_at_85%_0%,rgb(52_168_83/0.22),transparent_60%)]" : "border-line"
                }`}
              >
                {/* Same header as a private class, so cards side by side line up. */}
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-google-green/20">
                    <BoardIcon className={`h-7 w-7 ${c.url ? "text-google-green-light" : "text-muted"}`} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] tracking-[0.22em] text-muted uppercase">Google Classroom · course</p>
                    <p className="truncate text-lg font-semibold text-ink">
                      {c.title}
                      {c.batch && c.batch !== Batches.NOT_SURE && <span className="text-muted"> · {c.batch}</span>}
                    </p>
                  </div>
                </div>
                {c.batched && (!c.batch || c.batch === Batches.NOT_SURE) ? (
                  <p className="mt-4 text-sm text-muted">Your instructor will place you in a batch for your exam sitting; your class appears here then.</p>
                ) : !c.hasClass ? (
                  <p className="mt-4 text-sm text-muted">Your {c.batch} class opens soon. It appears here as soon as it&rsquo;s ready.</p>
                ) : c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className={JOIN}>
                    Join Google Classroom
                  </a>
                ) : c.access === "none" ? (
                  <form action={requestClassroom.bind(null, c.title)} className="mt-4">
                    <fieldset disabled={readOnly}>
                    <PendingButton
                      pendingLabel="Sending…"
                      className="inline-flex h-10 items-center rounded-md border border-google-green-light/50 px-4 text-sm font-semibold text-ink transition-colors hover:bg-google-green-light/15"
                    >
                      Request access
                    </PendingButton>
                    </fieldset>
                  </form>
                ) : (
                  <p className={`mt-4 text-sm ${c.access === "requested" ? "text-gold" : "text-muted"}`}>
                    {c.access === "requested"
                      ? "Request sent. The join button appears here once your instructor approves it."
                      : "Access is paused. Please message your instructor."}
                  </p>
                )}
              </li>
            ))}
        </ul>
        <p className="mt-5 text-sm text-muted">
          Join with <span className="font-semibold text-ink">{email}</span>, the same Google account you signed in with here.
        </p>
      </section>
  );
}
