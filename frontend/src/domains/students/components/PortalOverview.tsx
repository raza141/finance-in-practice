import { CalendarClock, CalendarDays, MapPin, Video } from "lucide-react";
import type { ReactNode } from "react";

import { StudyDays } from "../services/StudyDays";
import type { StudentSession, StudyPlanItem } from "../types";
import { BOOK_BUTTON, BUTTON, JOIN_BUTTON } from "./buttons";
import { HomePanel, HomeRow } from "./HomeRow";
import { InstallHint } from "./InstallHint";
import { TabButton } from "./StudentPortal";

const ZONE = "Asia/Dubai";
const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, ...o });
const TODAY = fmt({ weekday: "long", day: "numeric", month: "long" });
const MON = fmt({ month: "short" });
const DAYNUM = fmt({ day: "numeric" });
const WEEKDAY = fmt({ weekday: "long" });
const TIME = fmt({ hour: "2-digit", minute: "2-digit" });
const HOUR = fmt({ hour: "numeric", hourCycle: "h23" });
const dateOf = (ymd: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${ymd}T00:00:00Z`));

function greeting(now: Date) {
  const h = Number(HOUR.format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/**
 * The portal's first tab. Left: the next session, then one to-do list (plan topic, Classroom work, streamed in).
 * Right: where they stand (hours and balance, latest mock, what's new). Rows, not tiles: one tap opens the tab.
 */
export function PortalOverview({
  name,
  sessions,
  plan,
  classTodo,
  classNew,
  accountRow,
  mockRow,
  exam = null,
}: {
  name: string;
  sessions: StudentSession[] | null;
  plan: StudyPlanItem[] | null;
  /** Classroom work due or missing, as rows (streamed); null when Classroom isn't connected. */
  classTodo: ReactNode;
  /** What's new in their class, as a row (streamed); null when Classroom isn't connected. */
  classNew: ReactNode;
  accountRow: ReactNode;
  /** The latest mock mark; null when there are no mocks for them. */
  mockRow: ReactNode;
  /** Their next exam; hideCountdown: they asked not to see the days (Study plan's Hide). */
  exam?: { course: string; date: string; hideCountdown: boolean } | null;
}) {
  const now = new Date();
  const today = StudyDays.today();
  const [next, ...later] = sessions ?? [];
  const step = (plan ?? [])
    .filter((p) => p.status === "planned")
    .sort((a, b) => (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999"))[0];
  const overdue = step ? StudyDays.overdue(step, today) : false;
  const week = StudyDays.week(plan ?? [], today);
  const examDays = exam ? StudyDays.days(today, exam.date) : null;
  const weekLine = `This week: ${week.due} topic${week.due === 1 ? "" : "s"}${week.behind ? ` · ${week.behind} behind` : ""}`;

  return (
    <div className="grid gap-6">
      <header>
        <p className="font-mono text-xs tracking-[0.18em] text-muted uppercase">{TODAY.format(now)}</p>
        <h1 className="mt-1 text-3xl font-normal italic sm:text-4xl">
          {greeting(now)}, {name}
        </h1>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="grid gap-6">
          <NextSession next={next} more={later.length} failed={sessions === null} />

          <HomePanel title="To do">
            {step && (
              <HomeRow
                tab="plan"
                icon={CalendarDays}
                urgent={overdue}
                title={step.topic}
                detail={step.dueOn ? (overdue ? `Overdue · was due ${dateOf(step.dueOn)}` : `Study plan · by ${dateOf(step.dueOn)}`) : "Study plan · next up"}
              />
            )}
            {classTodo}
            {/* CSS, not data: shows only while the list above has no rows (Classroom rows stream in later). */}
            <li className="hidden px-3 py-3 text-sm text-muted only:block">Nothing due. Nice work.</li>
          </HomePanel>
        </div>

        <HomePanel title="At a glance" className="lg:sticky lg:top-24">
          {(exam || (plan ?? []).length > 0) && (
            <HomeRow
              tab="plan"
              icon={CalendarClock}
              urgent={week.behind > 0}
              title={
                // The database filters by its own (UTC) date: just after midnight in the UAE yesterday's exam can still arrive, so never a negative count.
                exam && !exam.hideCountdown && examDays !== null && examDays >= 0 ? (examDays === 0 ? `${exam.course} exam today` : `Exam in ${examDays} day${examDays === 1 ? "" : "s"}`) : "Your week"
              }
              detail={weekLine}
            />
          )}
          {accountRow}
          {mockRow}
          {classNew}
        </HomePanel>
      </div>

      <InstallHint />
    </div>
  );
}

/** The one big card: when, what, where, and the action that fits (Join, or Book when nothing is booked). */
function NextSession({ next, more, failed }: { next: StudentSession | undefined; more: number; failed: boolean }) {
  const card = "rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur-md sm:p-8";
  if (!next) {
    return (
      <section aria-labelledby="next-heading" className={`${card} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 id="next-heading" className="text-xl font-normal italic">
            {failed ? "Couldn’t load your sessions" : "No session booked"}
          </h2>
          <p className="mt-1 text-sm text-muted">{failed ? "Your confirmation emails have every detail." : "Pick a time that suits you; it takes a minute."}</p>
        </div>
        {!failed && (
          <TabButton tab="book" className={BOOK_BUTTON}>
            Book a session
          </TabButton>
        )}
      </section>
    );
  }
  const start = new Date(next.start);
  const Where = next.address ? MapPin : Video;
  return (
    <section aria-labelledby="next-heading" className={card}>
      <h2 id="next-heading" className="sr-only">
        Next session
      </h2>
      <div className="flex items-start gap-5">
        <div aria-hidden className="grid w-16 shrink-0 overflow-hidden rounded-2xl border border-line text-center">
          <span className="bg-surface-raised py-1 font-mono text-[11px] font-semibold tracking-[0.18em] text-quant uppercase">{MON.format(start)}</span>
          <span className="py-1.5 text-3xl font-semibold tabular-nums">{DAYNUM.format(start)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted">Next session</p>
          <p className="text-2xl font-semibold text-ink">
            {WEEKDAY.format(start)}, {TIME.format(start)}–{TIME.format(new Date(next.end))}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="text-ink/90">{next.course}</span>
            <span className="inline-flex items-center gap-1.5">
              <Where aria-hidden className="size-4" />
              {next.address ?? "Online · Zoom"}
            </span>
            {next.status === "pending" && <span className="rounded-full border border-dashed border-gold px-2 py-0.5 text-xs text-gold">Awaiting confirmation</span>}
          </p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {next.meetingUrl && (
          <a href={next.meetingUrl} target="_blank" rel="noreferrer" className={JOIN_BUTTON}>
            Join session
          </a>
        )}
        <TabButton tab="sessions" className={BUTTON}>
          {more > 0 ? `All sessions (${more + 1})` : "My sessions"}
        </TabButton>
      </div>
    </section>
  );
}
