import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import type { CalBookingDetail } from "@/domains/booking/server/CalComClient";

import { decideHourRequest } from "../actions/account";
import { removeSessionLog, saveSessionLog } from "../actions/sessionLog";
import { SessionLogContract } from "../services/SessionLogContract";
import type { HourRequest, MonthAllowance, SessionLogEntry } from "../types";

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const hours = (minutes: number) => String(Math.round((minutes / 60) * 100) / 100);
const SMALL = "h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink";

/**
 * The admin side of the hours a student studied: each past Cal.com session with
 * the time actually spent (booked 1 h, studied 2; 0 = didn't happen), and
 * sessions never booked in Cal.com. The student sees the result under Hours & payments.
 */
export function SessionLogEditor({
  clientId,
  bookings,
  log,
  today,
  requests,
  allowance,
}: {
  clientId: string;
  /** Null: Cal.com couldn't be read. */
  bookings: CalBookingDetail[] | null;
  log: SessionLogEntry[];
  today: string;
  requests: HourRequest[];
  /** This month's hours on a monthly agreement with a limit; null without one. */
  allowance: MonthAllowance | null;
}) {
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending").slice(0, 6);
  const corrected = log.filter((l) => l.bookingUid).length;
  const manual = log.filter((l) => l.onDate);
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  return (
    <section id="sessions" className="mt-12 rounded-lg border border-line p-5">
      <h2 className="text-lg">Sessions &amp; hours</h2>
      <p className="mt-1 text-sm text-muted">
        To correct a session that ran longer or shorter than booked, open it on the{" "}
        <a href="/admin/schedule" className="text-quant hover:underline">
          Schedule
        </a>{" "}
        and set the hours studied. Sessions agreed outside Cal.com are logged below. Cal.com and the student are never notified.
      </p>

      {allowance && (
        <p className={`mt-4 text-sm ${allowance.leftMinutes < 0 ? "text-gold" : "text-ink"}`}>
          {DAY.format(new Date(`${allowance.periodStart}T00:00:00Z`))} – {DAY.format(new Date(`${allowance.periodEnd}T00:00:00Z`))}: {hours(allowance.takenMinutes)} h studied + {hours(allowance.bookedMinutes)} h booked of {hours(allowance.includedMinutes)} h
          {allowance.extraMinutes > 0 && ` + ${hours(allowance.extraMinutes)} h extra`} ·{" "}
          {allowance.leftMinutes < 0 ? `${hours(-allowance.leftMinutes)} h over` : `${hours(allowance.leftMinutes)} h left`}
        </p>
      )}

      {pending.map((r) => (
        <div key={r.id} className="mt-4 rounded-md border border-gold/40 bg-gold/5 p-3 text-sm">
          <p className="text-ink">
            Asks for <strong>{r.hours} more hours</strong> in {r.month}
            {r.note && <span className="text-muted"> · &ldquo;{r.note}&rdquo;</span>}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["free", "Approve, included"],
                ["billed", "Approve, extra to pay"],
                ["declined", "Decline"],
              ] as const
            ).map(([status, label]) => (
              <form key={status} action={decideHourRequest}>
                {hidden("clientId", clientId)}
                {hidden("requestId", r.id)}
                {hidden("status", status)}
                <PendingButton pendingLabel="Saving…" className={status === "declined" ? "h-9 px-3 text-sm text-red-300/90 hover:underline" : SMALL}>
                  {label}
                </PendingButton>
              </form>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">&ldquo;Extra to pay&rdquo; only marks it: add the hours to their next invoice.</p>
        </div>
      ))}
      {decided.length > 0 && (
        <p className="mt-3 text-xs text-muted">
          Earlier requests:{" "}
          {decided.map((r) => `${r.month} ${r.hours} h ${r.status === "free" ? "included" : r.status === "billed" ? "to pay" : "declined"}`).join(", ")}
        </p>
      )}

      {bookings === null && <p className="mt-4 text-sm text-gold">Couldn&rsquo;t load their Cal.com sessions just now, so this month&rsquo;s hours may be incomplete.</p>}
      {corrected > 0 && (
        <p className="mt-3 text-xs text-muted">
          {corrected} past {corrected === 1 ? "session has" : "sessions have"} corrected hours.
        </p>
      )}

      {manual.length > 0 && (
        <>
          <h3 className="mt-6 text-sm text-muted">Logged by hand</h3>
          <ul className="mt-2 divide-y divide-line/60 text-sm">
            {manual.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span className="text-ink">
                  {DAY.format(new Date(`${l.onDate}T00:00:00Z`))} · {hours(l.minutes)} h
                  {l.note && <span className="text-muted"> · {l.note}</span>}
                </span>
                <form action={removeSessionLog}>
                  {hidden("clientId", clientId)}
                  {hidden("logId", l.id)}
                  <PendingButton pendingLabel="Removing…" className="text-xs text-red-300/90 hover:underline">
                    Remove
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-quant">+ Log a session not booked in Cal.com</summary>
        <form action={saveSessionLog} className="mt-3 flex flex-wrap items-end gap-3">
          {hidden("clientId", clientId)}
          <label className="text-xs text-muted">
            Day
            <input name="onDate" type="date" required max={today} defaultValue={today} className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Hours
            <input name="hours" inputMode="decimal" required placeholder="1.5" className={`${FIELD} mt-1 w-24`} />
          </label>
          <label className="min-w-48 flex-1 text-xs text-muted">
            Note (optional)
            <input name="note" maxLength={SessionLogContract.NOTE} placeholder="e.g. Extra revision on WhatsApp call" className={`${FIELD} mt-1`} />
          </label>
          <PendingButton pendingLabel="Logging…" className={SMALL}>
            Log session
          </PendingButton>
        </form>
      </details>
    </section>
  );
}
