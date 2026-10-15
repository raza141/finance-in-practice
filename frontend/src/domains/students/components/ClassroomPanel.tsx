import { PendingButton } from "@/domains/admin/components/PendingButton";

import { requestClassroom } from "../actions/classroom";
import type { PrivateClassroom, StudentClassroom } from "../types";

const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";

/** Inline chalkboard mark (no image request). */
function BoardIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="2.5" y="4" width="19" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="9" r="2" fill="currentColor" />
      <path d="M8.5 14c.6-1.5 1.9-2.3 3.5-2.3s2.9.8 3.5 2.3M7 20h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const JOIN =
  "mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#1e8e3e] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#188038]";

/** A class just for this student: the invite is there from the start. */
function OwnClassCard({ c }: { c: PrivateClassroom }) {
  return (
    <li className="relative overflow-hidden rounded-2xl border border-[#34a853]/40 bg-[radial-gradient(circle_at_85%_0%,rgb(52_168_83/0.25),transparent_60%)] p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#1e8e3e]/20">
          <BoardIcon className="h-7 w-7 text-[#34a853]" />
        </span>
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.22em] text-muted uppercase">Google Classroom · just for you</p>
          <p className="truncate text-lg font-semibold text-ink">{c.title}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-ink/80">{c.note || "Your notes, homework and files from your instructor, in one private class."}</p>
      <a href={c.url} target="_blank" rel="noreferrer" className={JOIN}>
        Open my classroom <span aria-hidden>↗</span>
      </a>
    </li>
  );
}

/**
 * The portal's Classroom tab: private classes the owner added for this student
 * first, then one shared Classroom per course or batch (access approved per student).
 */
export function ClassroomPanel({ classes, own, email }: { classes: StudentClassroom[]; own: PrivateClassroom[]; email: string }) {
  return (
    <section aria-labelledby="classroom-heading" className={CARD}>
        <h2 id="classroom-heading" className="text-2xl font-normal italic">
          Your classrooms
        </h2>
        {own.length > 0 && (
          <ul aria-label="Just for you" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {own.map((c) => (
              <OwnClassCard key={c.id} c={c} />
            ))}
          </ul>
        )}
        {classes.length > 0 && (
          <>
          {own.length > 0 && <h3 className="mt-8 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Course classrooms</h3>}
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <li
                key={c.title}
                className={`relative overflow-hidden rounded-2xl border p-5 ${
                  c.url ? "border-[#34a853]/30 bg-[radial-gradient(circle_at_85%_0%,rgb(52_168_83/0.22),transparent_60%)]" : "border-line"
                }`}
              >
                <BoardIcon className={`h-9 w-9 ${c.url ? "text-[#34a853]" : "text-muted"}`} />
                <p className="mt-3 font-mono text-[10px] tracking-[0.22em] text-muted uppercase">Google Classroom</p>
                <p className="mt-1 text-lg font-semibold text-ink">{c.title}</p>
                {c.url ? (
                  <a href={c.url} target="_blank" rel="noreferrer" className={JOIN}>
                    Join Google Classroom <span aria-hidden>↗</span>
                  </a>
                ) : c.access === "none" ? (
                  <form action={requestClassroom.bind(null, c.title)} className="mt-4">
                    <PendingButton
                      pendingLabel="Sending…"
                      className="inline-flex h-10 items-center rounded-md border border-[#34a853]/50 px-4 text-sm font-semibold text-ink transition-colors hover:bg-[#34a853]/15"
                    >
                      Request access
                    </PendingButton>
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
          </>
        )}
        <p className="mt-5 text-sm text-muted">
          Join with <span className="font-semibold text-ink">{email}</span>, the same Google account you signed in with here.
        </p>
      </section>
  );
}
