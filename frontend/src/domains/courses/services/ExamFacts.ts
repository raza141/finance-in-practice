import type { Ticker } from "@/domains/testimonials/types";

export interface ExamFact {
  value: string;
  label: string;
}

/** An exam window. Only the month label is ever shown; `starts` is approximate and used for filtering. */
export interface ExamWindow {
  label: string;
  starts: string;
}

export interface ExamProfile {
  facts: ExamFact[];
  windows: ExamWindow[];
  /** Latest published result; stale after each exam window, so it always carries its window and source. */
  passRate?: { value: string; window: string; source: string };
}

/**
 * Official exam numbers by course ticker, for "at a glance" strips.
 * Sources: CFA Institute Level I/II exam pages, CFA Institute press release
 * (24 Sep 2026), GARP FRM exam page. Update after each results release.
 * Windows: CFA Institute runs Level I in Feb/May/Aug/Nov and Level II in
 * May/Aug/Nov; GARP runs FRM in May/Aug/Nov (Nov 2026: 14–20, 2027 dates TBD).
 */
export class ExamFacts {
  private static readonly BY_TICKER: Partial<Record<Ticker, ExamProfile>> = {
    CFA1: {
      facts: [
        { value: "180", label: "questions" },
        { value: "4h 30m", label: "exam time" },
        { value: "300+ h", label: "typical study" },
      ],
      passRate: { value: "43%", window: "Aug 2026", source: "CFA Institute" },
      windows: [
        { label: "Nov 2026", starts: "2026-11-10" },
        { label: "Feb 2027", starts: "2027-02-20" },
        { label: "May 2027", starts: "2027-05-10" },
        { label: "Aug 2027", starts: "2027-08-15" },
        { label: "Nov 2027", starts: "2027-11-10" },
      ],
    },
    CFA2: {
      facts: [
        { value: "22", label: "item sets" },
        { value: "4h 24m", label: "exam time" },
        { value: "300+ h", label: "typical study" },
      ],
      windows: [
        { label: "Nov 2026", starts: "2026-11-15" },
        { label: "May 2027", starts: "2027-05-15" },
        { label: "Aug 2027", starts: "2027-08-20" },
        { label: "Nov 2027", starts: "2027-11-15" },
      ],
    },
    FRM1: {
      facts: [
        { value: "100", label: "questions" },
        { value: "4h", label: "exam time" },
        { value: "240 h", label: "typical study" },
      ],
      passRate: { value: "47%", window: "Nov 2025", source: "GARP" },
      windows: [
        { label: "Nov 2026", starts: "2026-11-14" },
        { label: "May 2027", starts: "2027-05-01" },
        { label: "Aug 2027", starts: "2027-08-01" },
        { label: "Nov 2027", starts: "2027-11-01" },
      ],
    },
  };

  /** Days of preparation a new learner needs before a window is worth showing. */
  static readonly MIN_PREP_DAYS = 42;

  /** The next windows a learner starting today can still prepare for. */
  static nextWindows(profile: ExamProfile, now: Date, count = 2): ExamWindow[] {
    const cutoff = now.getTime() + ExamFacts.MIN_PREP_DAYS * 86_400_000;
    return profile.windows.filter((w) => Date.parse(`${w.starts}T00:00:00Z`) >= cutoff).slice(0, count);
  }

  static for(ticker: Ticker | null): ExamProfile | null {
    return (ticker && ExamFacts.BY_TICKER[ticker]) || null;
  }
}
