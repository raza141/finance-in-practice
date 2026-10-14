import { siteConfig } from "@/core/config/site";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { Schedule } from "@/domains/schedule/services/Schedule";

import { StudyPlanRepository } from "../server/StudyPlanRepository";
import type { Student, StudyPlanItem } from "../types";

const SESSION_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: Schedule.TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const PLAN_DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const MARK: Record<StudyPlanItem["status"], { icon: string; className: string }> = {
  done: { icon: "✓", className: "border-quant bg-quant text-canvas" },
  skipped: { icon: "–", className: "border-line bg-canvas text-muted" },
  planned: { icon: "", className: "border-line bg-canvas" },
};

/** Null when Cal.com is unreachable, so the page still renders. */
async function upcoming(email: string): Promise<CalBookingDetail[] | null> {
  try {
    return (await CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug)?.upcomingFor(email)) ?? [];
  } catch (error) {
    console.error("student: could not load sessions", error);
    return null;
  }
}

async function plan(clientId: string): Promise<StudyPlanItem[] | null> {
  try {
    return (await StudyPlanRepository.fromEnv()?.forClient(clientId)) ?? [];
  } catch (error) {
    console.error("student: could not load the study plan", error);
    return null;
  }
}

/** The signed-in student's booked sessions (from Cal.com) and the study plan their instructor keeps in admin. */
export async function StudentDashboard({ student }: { student: Student }) {
  const [sessions, items] = await Promise.all([upcoming(student.email), plan(student.id)]);
  const next = items?.find((i) => i.status === "planned");

  return (
    <div className="grid gap-8">
      <section aria-labelledby="sessions-heading" className="rounded-3xl border border-white/10 bg-canvas/60 p-6 backdrop-blur-md sm:p-8">
        <h2 id="sessions-heading" className="text-2xl font-normal italic">
          Upcoming sessions
        </h2>
        {sessions === null ? (
          <p className="mt-3 text-sm text-muted">Couldn&rsquo;t load your sessions right now. Your confirmation emails have every detail.</p>
        ) : sessions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nothing booked yet. Pick a time above.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60">
            {sessions.map((s) => (
              <li key={s.uid} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span className="tabular-data font-semibold text-ink">{SESSION_TIME.format(new Date(s.start))}</span>
                <span className="flex-1 text-muted">
                  {s.metadata?.course || s.title}
                  {s.status === "pending" && <span className="text-gold"> · awaiting confirmation</span>}
                </span>
                {s.meetingUrl?.startsWith("https://") && (
                  <a href={s.meetingUrl} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                    Join ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted">Times in UAE time (GST).</p>
      </section>

      {items !== null && items.length > 0 && (
        <section aria-labelledby="plan-heading" className="rounded-3xl border border-white/10 bg-canvas/60 p-6 backdrop-blur-md sm:p-8">
          <h2 id="plan-heading" className="text-2xl font-normal italic">
            Your study plan
          </h2>
          <p className="mt-1 text-sm text-muted">
            {items.filter((i) => i.status === "done").length} of {items.length} topics done
          </p>
          <ol className="mt-5 grid gap-0">
            {items.map((item, index) => (
              <li key={item.id} className="relative flex gap-4 pb-5 last:pb-0">
                {index < items.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-line" />}
                <span
                  aria-hidden
                  className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs ${
                    item === next ? "border-gold bg-gold/20" : MARK[item.status].className
                  }`}
                >
                  {MARK[item.status].icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted">
                    {item.dueOn ? PLAN_DAY.format(new Date(`${item.dueOn}T00:00:00Z`)) : "To be scheduled"}
                    {item === next && <span className="ml-2 font-semibold text-gold">Up next</span>}
                    <span className="sr-only"> · {item.status}</span>
                  </p>
                  <p className={`mt-0.5 font-semibold ${item.status === "skipped" ? "text-muted line-through" : "text-ink"}`}>{item.topic}</p>
                  {item.note && <p className="mt-1 text-sm text-ink/80">{item.note}</p>}
                  {item.materialUrl && (
                    <a href={item.materialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-quant hover:underline">
                      Open material ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
