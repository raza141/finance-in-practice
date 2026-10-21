export type HourRequestResult = { ok: true; value: { month: string; hours: number; note: string } } | { ok: false; error: string };

/** Validation for a student's "Request more hours" form. Pure: limits mirror hour_requests (050). */
export class HourRequestContract {
  static readonly MAX_HOURS = 100;
  static readonly NOTE = 300;

  /** `month` must be this month or next (`allowed`), hours above 0 with up to two decimals. */
  static parse(fields: Record<string, unknown>, allowed: readonly string[]): HourRequestResult {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const month = text("month");
    if (!allowed.includes(month)) return { ok: false, error: "Ask for this month or next." };
    const raw = text("hours").replace(",", ".");
    const hours = Number(raw);
    if (!/^\d+(\.\d{1,2})?$/.test(raw) || hours <= 0 || hours > HourRequestContract.MAX_HOURS) {
      return { ok: false, error: `How many extra hours? Above 0, up to ${HourRequestContract.MAX_HOURS}.` };
    }
    const note = text("note");
    if (note.length > HourRequestContract.NOTE) return { ok: false, error: `Keep the note under ${HourRequestContract.NOTE} characters.` };
    return { ok: true, value: { month, hours, note } };
  }
}
