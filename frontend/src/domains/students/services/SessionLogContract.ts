import type { SessionLogInput } from "../types";

export type SessionLogResult = { ok: true; value: SessionLogInput } | { ok: false; error: string };

/** Validation for the owner's session log. Pure: limits mirror the 049_session_log CHECKs. */
export class SessionLogContract {
  static readonly MAX_HOURS = 10;
  static readonly NOTE = 200;
  private static readonly DATE = /^\d{4}-\d{2}-\d{2}$/;

  /**
   * One row from admin Clients: `hours` studied (0 = didn't happen, up to two decimals),
   * and either the Cal.com `bookingUid` or, for a session never booked, its `onDate` (not in the future).
   */
  static parse(fields: Record<string, unknown>, today: string): SessionLogResult {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const raw = text("hours").replace(",", ".");
    const hours = Number(raw);
    if (raw === "" || !/^\d+(\.\d{1,2})?$/.test(raw) || hours > SessionLogContract.MAX_HOURS) {
      return { ok: false, error: `Enter the hours studied, from 0 to ${SessionLogContract.MAX_HOURS} (e.g. 1.5).` };
    }
    const note = text("note");
    if (note.length > SessionLogContract.NOTE) return { ok: false, error: `Keep the note under ${SessionLogContract.NOTE} characters.` };
    const bookingUid = text("bookingUid");
    const onDate = text("onDate");
    if (bookingUid && onDate) return { ok: false, error: "A session is either a booking or a date, not both." };
    if (bookingUid) {
      if (bookingUid.length > 100) return { ok: false, error: "That booking reference isn't valid." };
    } else if (!SessionLogContract.DATE.test(onDate) || Number.isNaN(Date.parse(`${onDate}T00:00:00Z`)) || onDate > today) {
      return { ok: false, error: "Pick the day of the session (today or earlier)." };
    }
    return { ok: true, value: { bookingUid: bookingUid || null, onDate: bookingUid ? null : onDate, minutes: Math.round(hours * 60), note } };
  }
}
