import { PendingButton } from "@/domains/admin/components/PendingButton";

import { requestClassroom } from "../actions/classroom";
import type { StudentClassroom } from "../types";

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

const HOW = [
  ["Stream", "Announcements, group classes and mock exams for everyone in your batch."],
  ["Classwork", "Files and homework. Some are posted just for you; classmates can't see those."],
  ["Private comments", "Questions only you and your instructor can read."],
] as const;

/** The portal's Classroom tab: one Google Classroom per course or batch (links set in admin Courses, access approved per student). */
export function ClassroomPanel({ classes, email }: { classes: StudentClassroom[]; email: string }) {
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="classroom-heading" className={CARD}>
        <h2 id="classroom-heading" className="text-2xl font-normal italic">
          Your classrooms
        </h2>
        {classes.length === 0 ? (
          <div className="mt-5 flex items-center gap-4 rounded-2xl border border-dashed border-line p-5">
            <BoardIcon className="h-10 w-10 shrink-0 text-muted" />
            <p className="text-sm text-muted">Your instructor will add your Google Classroom link here when your class opens.</p>
          </div>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
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
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-[#1e8e3e] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#188038]"
                  >
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
        )}
        <p className="mt-5 text-sm text-muted">
          Join with <span className="font-semibold text-ink">{email}</span>, the same Google account you signed in with here.
        </p>
      </section>

      <aside aria-labelledby="how-heading" className={CARD}>
        <h2 id="how-heading" className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
          What&rsquo;s where
        </h2>
        <ul className="mt-4 grid gap-4">
          {HOW.map(([title, text]) => (
            <li key={title}>
              <p className="text-sm font-semibold text-ink">{title}</p>
              <p className="mt-0.5 text-sm text-muted">{text}</p>
            </li>
          ))}
          <li className="border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">Times and bookings</p>
            <p className="mt-0.5 text-sm text-muted">Always here, under My sessions, including group classes.</p>
          </li>
        </ul>
      </aside>
    </div>
  );
}
