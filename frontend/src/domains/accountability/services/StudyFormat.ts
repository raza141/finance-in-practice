import type { Band } from "./OnTrack";

/** How the loop's figures read, the same in the portal, the tutor's page and the email. */
export class StudyFormat {
  static readonly BAND: Record<Band, { label: string; tone: string }> = {
    on_track: { label: "On track", tone: "text-emerald-300" },
    slipping: { label: "Slipping", tone: "text-gold" },
    at_risk: { label: "At risk", tone: "text-slate-300" },
  };
  private static readonly DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  static hours(hours: number): string {
    return `${Math.round(hours * 10) / 10} h`;
  }

  /** Time still to do: minutes under an hour, rounded up, so "0 h" never shows with work left. */
  static toDo(hours: number): string {
    return hours < 1 ? `${Math.ceil(hours * 60)} min` : StudyFormat.hours(hours);
  }

  static percent(share: number | null): string {
    return share === null ? "No answers" : `${Math.round(share * 100)}%`;
  }

  static count(n: number, word: string): string {
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  }

  /** "Mon": for a date at most two days off, where the row is narrow. */
  static weekday(date: string): string {
    return StudyFormat.day(date).slice(0, 3);
  }

  static day(date: string): string {
    return StudyFormat.DAY.format(new Date(`${date}T00:00:00Z`));
  }
}
