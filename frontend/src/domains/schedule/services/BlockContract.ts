import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";

import type { TimeRange } from "../types";
import { Schedule } from "./Schedule";

export type BlockInput = { ok: true; range: TimeRange; reason: string } | { ok: false; message: string };

/**
 * Block-time form -> a Dubai-time range. One day with from/to times, or
 * whole days from `date` through `until`.
 */
export class BlockContract {
  static readonly MAX_DAYS = 31;

  static parse(form: FormData): BlockInput {
    const field = (name: string) => {
      const v = form.get(name);
      return typeof v === "string" ? v.trim() : "";
    };
    const date = field("date");
    const until = field("until") || date;
    const allDay = form.get("allDay") === "on";
    const from = allDay ? "00:00" : field("from");
    const to = allDay ? "24:00" : field("to");
    const reason = field("reason").slice(0, 120);

    if (!ZonedCalendar.isIsoDate(date) || !ZonedCalendar.isIsoDate(until)) return { ok: false, message: "Pick a valid date." };
    if (until < date) return { ok: false, message: "“Until” is before the start date." };
    if (ZonedCalendar.daysBetween(date, until) >= BlockContract.MAX_DAYS) return { ok: false, message: "Block at most 31 days at a time." };
    if (!Schedule.TIME.test(from) || !(Schedule.TIME.test(to) || to === "24:00")) return { ok: false, message: "Pick a start and end time." };

    const range = { start: Schedule.instant(date, from), end: Schedule.instant(until, to) };
    if (range.end <= range.start) return { ok: false, message: "End must be after start." };
    return { ok: true, range, reason };
  }
}
