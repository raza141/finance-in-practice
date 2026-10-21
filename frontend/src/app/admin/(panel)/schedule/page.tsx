import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { ScheduleBoard } from "@/domains/schedule/components/ScheduleBoard";
import { BlockRepository } from "@/domains/schedule/server/BlockRepository";
import { Schedule } from "@/domains/schedule/services/Schedule";
import { SessionLogRepository } from "@/domains/students/server/SessionLogRepository";

export const metadata: Metadata = { title: "Schedule" };

/** Settled value, or the fallback plus a warning when that source failed. */
function settled<T>(result: PromiseSettledResult<T>, fallback: T, source: string, warnings: string[]): T {
  if (result.status === "fulfilled") return result.value;
  console.error(`[schedule] ${source} failed`, result.reason);
  warnings.push(`${source} could not be loaded, so this week may be incomplete.`);
  return fallback;
}

/** Every week, not just this one: each waits for Confirm or Decline (open its week, click it). */
function awaitingConfirmation(bookings: CalBookingDetail[]): CalBookingDetail[] {
  const now = Date.now();
  return bookings.filter((b) => b.status === "pending" && Date.parse(b.end) > now).toSorted((a, b) => a.start.localeCompare(b.start));
}

export default async function AdminSchedulePage({ searchParams }: PageProps<"/admin/schedule">) {
  const admin = await AdminAuth.require();
  const today = new ZonedCalendar(Schedule.TIME_ZONE).today();
  const requested = (await searchParams).week;
  const weekStart = Schedule.weekStart(ZonedCalendar.isIsoDate(requested) ? requested : today);
  const weekEnd = ZonedCalendar.addDays(weekStart, 6);
  const from = Schedule.instant(weekStart, "00:00");
  const to = Schedule.instant(weekEnd, "24:00");

  const cal = CalComClient.fromEnv();
  const repo = BlockRepository.fromEnv();
  const [bookings, busy, blocks, unconfirmed] = await Promise.allSettled([
    cal ? cal.bookings(from, to) : Promise.resolve([]),
    cal ? cal.busyTimes(weekStart, weekEnd, Schedule.TIME_ZONE) : Promise.resolve([]),
    repo ? repo.between(from, to) : Promise.resolve([]),
    cal ? cal.unconfirmed() : Promise.resolve([]),
  ]);
  const warnings: string[] = [];
  if (!cal) warnings.push("Cal.com is not configured (CAL_API_KEY), so bookings and calendars are not shown.");
  if (!repo) warnings.push("The database is not configured, so blocked time can't be saved.");
  const merged = Schedule.merge(
    settled(bookings, [], "Website bookings", warnings),
    settled(busy, [], "Google/Apple calendar busy times", warnings),
    settled(blocks, [], "Blocked time", warnings),
  );
  // The owner's "studied" corrections on this week's sessions (hours only the owner sees and edits).
  const owner = admin.role === "owner";
  const studied = owner
    ? await (SessionLogRepository.fromEnv()?.byBookingUids(merged.filter((e) => e.kind === "booking").map((e) => e.id)) ?? Promise.resolve(new Map<string, number>())).catch(
        (error) => (console.error("[schedule] session log failed", error), new Map<string, number>()),
      )
    : new Map<string, number>();
  const events = Schedule.markEnded(merged.map((e) => (studied.has(e.id) ? { ...e, studiedMinutes: studied.get(e.id) } : e)));

  const waiting = awaitingConfirmation(settled(unconfirmed, [], "Bookings waiting for confirmation", warnings));
  const dubai = new ZonedCalendar(Schedule.TIME_ZONE);

  const week = (offset: number) => `/admin/schedule?week=${ZonedCalendar.addDays(weekStart, offset)}`;
  const label = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

  return (
    <div className="max-w-7xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-3xl font-normal tracking-tight italic">Schedule</h1>
        <nav aria-label="Week" className="flex items-center gap-2 text-sm">
          <Link href={week(-7)} className="rounded-md border border-line px-3 py-1.5 hover:border-quant" aria-label="Previous week">
            ←
          </Link>
          <Link href="/admin/schedule" className="rounded-md border border-line px-3 py-1.5 hover:border-quant">
            Today
          </Link>
          <Link href={week(7)} className="rounded-md border border-line px-3 py-1.5 hover:border-quant" aria-label="Next week">
            →
          </Link>
          <span className="ml-2 tabular-nums text-muted">
            {label(weekStart)} – {label(weekEnd)}
          </span>
        </nav>
      </div>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        The website only offers times that are free here: your Cal.com working hours, minus website bookings, minus anything in
        your Google or Apple calendar, minus time blocked on this page.
      </p>
      {warnings.map((w) => (
        <p key={w} role="alert" className="mt-3 text-sm text-gold">
          {w}
        </p>
      ))}
      {waiting.length > 0 && (
        <section aria-label="Waiting for confirmation" className="mt-5 rounded-lg border border-dashed border-gold bg-gold/5 p-4">
          <h2 className="text-sm font-semibold text-gold">
            {waiting.length} {waiting.length === 1 ? "booking is" : "bookings are"} waiting for your confirmation
          </h2>
          <p className="mt-1 text-xs text-muted">Each time stays held until you decide. Open it in the week below to confirm or decline.</p>
          <ul className="mt-3 grid gap-1.5 text-sm">
            {waiting.map((b) => {
              const date = dubai.dateOf(new Date(b.start));
              return (
                <li key={b.uid}>
                  <Link href={`/admin/schedule?week=${Schedule.weekStart(date)}`} className="flex flex-wrap gap-x-3 hover:text-quant">
                    <span className="w-40 font-mono text-xs text-muted">
                      {label(date)} {dubai.timeOf(new Date(b.start))}
                    </span>
                    <span>{b.attendees[0]?.name || b.title}</span>
                    <span className="text-muted">{b.metadata?.course}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <ScheduleBoard key={weekStart} weekStart={weekStart} today={today} events={events} owner={owner} />
    </div>
  );
}
