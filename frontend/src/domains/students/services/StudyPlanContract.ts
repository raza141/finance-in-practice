import type { StudyPlanInput, StudyStatus } from "../types";

export type StudyPlanResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validation for study plan rows. Pure: limits mirror the 036_study_plan CHECKs. */
export class StudyPlanContract {
  static readonly STATUSES: Record<StudyStatus, string> = { planned: "Planned", done: "Done", skipped: "Skipped" };
  static readonly LIMITS = { topic: [2, 160], note: 500, url: 500, lines: 60 } as const;
  private static readonly DATE = /^\d{4}-\d{2}-\d{2}$/;

  /** One edited row from the admin form. */
  static parseItem(fields: Record<string, unknown>): StudyPlanResult<StudyPlanInput> {
    const text = (name: string) => (typeof fields[name] === "string" ? (fields[name] as string).trim() : "");
    const status = text("status") as StudyStatus;
    if (!(status in StudyPlanContract.STATUSES)) return { ok: false, error: "Choose a status." };
    const note = text("note");
    if (note.length > StudyPlanContract.LIMITS.note) return { ok: false, error: `Keep the note under ${StudyPlanContract.LIMITS.note} characters.` };
    return StudyPlanContract.row(text("dueOn"), text("topic"), text("materialUrl"), status, note);
  }

  /**
   * The admin's "add topics" box: one topic per line, optionally starting with a
   * date and ending with a link, e.g. "2026-11-03 Ethics https://drive.google.com/…".
   */
  static parseLines(raw: string): StudyPlanResult<StudyPlanInput[]> {
    const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return { ok: false, error: "Add at least one topic." };
    if (lines.length > StudyPlanContract.LIMITS.lines) return { ok: false, error: `Add at most ${StudyPlanContract.LIMITS.lines} topics at a time.` };
    const items: StudyPlanInput[] = [];
    for (const [index, line] of lines.entries()) {
      const [, date = "", topic = "", url = ""] = /^(\d{4}-\d{2}-\d{2})?\s*(.*?)\s*(https?:\/\/\S+)?$/.exec(line) ?? [];
      const parsed = StudyPlanContract.row(date, topic, url, "planned", "");
      if (!parsed.ok) return { ok: false, error: `Line ${index + 1}: ${parsed.error}` };
      items.push(parsed.value);
    }
    return { ok: true, value: items };
  }

  static isDate(value: string): boolean {
    if (!StudyPlanContract.DATE.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  /** Only https links: the student page renders them as hrefs. */
  static isLink(value: string): boolean {
    if (!value.startsWith("https://") || value.length > StudyPlanContract.LIMITS.url) return false;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }

  private static row(dueOn: string, topic: string, url: string, status: StudyStatus, note: string): StudyPlanResult<StudyPlanInput> {
    const [min, max] = StudyPlanContract.LIMITS.topic;
    if (dueOn && !StudyPlanContract.isDate(dueOn)) return { ok: false, error: "Dates are YYYY-MM-DD." };
    if (topic.length < min || topic.length > max) return { ok: false, error: `Topics are ${min}–${max} characters.` };
    if (url && !StudyPlanContract.isLink(url)) return { ok: false, error: "Material links must start with https://." };
    return { ok: true, value: { dueOn: dueOn || null, topic, status, note, materialUrl: url || null } };
  }
}
