import type { ReactNode } from "react";

import type { StudentSession, StudyPlanItem } from "../types";
import { InstallHint } from "./InstallHint";
import { TabButton } from "./StudentPortal";

const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md";
const LABEL = "font-mono text-[11px] tracking-[0.22em] text-muted uppercase";
const LINK = "mt-3 text-sm text-quant hover:underline";
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" }).format(new Date(iso));
const dateOf = (ymd: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

/** The portal's first tab: the next session, the Classroom cards (streamed in: to-do, latest mock, what's new), then the plan. */
export function PortalOverview({ sessions, plan, classCards }: { sessions: StudentSession[] | null; plan: StudyPlanItem[] | null; classCards: ReactNode }) {
  const next = sessions?.[0];
  const step = (plan ?? [])
    .filter((p) => p.status === "planned")
    .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"))[0];
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <section className={CARD}>
        <h2 className={LABEL}>Next session</h2>
        {next ? (
          <>
            <p className="mt-2 text-xl font-semibold text-ink">{when(next.start)}</p>
            <p className="text-sm text-muted">
              {next.course} · {next.address ?? "Online"}
              {next.status === "pending" && <span className="text-gold"> · awaiting confirmation</span>}
            </p>
            <p className="flex flex-wrap gap-4">
              {next.meetingUrl && (
                <a href={next.meetingUrl} target="_blank" rel="noreferrer" className={LINK}>
                  Join ↗
                </a>
              )}
              <TabButton tab="sessions" className={LINK}>
                All sessions →
              </TabButton>
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">{sessions === null ? "Couldn't load your sessions just now." : "Nothing booked yet."}</p>
            <TabButton tab="book" className="mt-4 inline-flex h-10 items-center rounded-md bg-gold px-4 text-sm font-semibold text-canvas hover:bg-gold-bright">
              Book a session
            </TabButton>
          </>
        )}
      </section>
      {classCards}
      {/* Last: the instructor rarely assigns plan steps directly; Classroom carries most of the work. */}
      <section className={CARD}>
        <h2 className={LABEL}>Study plan</h2>
        {step ? (
          <>
            <p className="mt-2 text-xl font-semibold text-ink">{step.topic}</p>
            <p className="text-sm text-muted">{step.dueOn ? `By ${dateOf(step.dueOn)}` : "Next up"}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted">Your instructor adds your plan here.</p>
        )}
        <TabButton tab="plan" className={LINK}>
          Plan & materials →
        </TabButton>
      </section>
      <InstallHint />
    </div>
  );
}
