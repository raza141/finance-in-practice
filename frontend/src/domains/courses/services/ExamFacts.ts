import type { Ticker } from "@/domains/testimonials/types";

export interface ExamFact {
  value: string;
  label: string;
}

export interface ExamProfile {
  facts: ExamFact[];
  /** Latest published result; stale after each exam window, so it always carries its window and source. */
  passRate?: { value: string; window: string; source: string };
}

/**
 * Official exam numbers by course ticker, for "at a glance" strips.
 * Sources: CFA Institute Level I/II exam pages, CFA Institute press release
 * (24 Sep 2026), GARP FRM exam page. Update after each results release.
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
    },
    CFA2: {
      facts: [
        { value: "22", label: "item sets" },
        { value: "4h 24m", label: "exam time" },
        { value: "300+ h", label: "typical study" },
      ],
    },
    FRM1: {
      facts: [
        { value: "100", label: "questions" },
        { value: "4h", label: "exam time" },
        { value: "240 h", label: "typical study" },
      ],
      passRate: { value: "47%", window: "Nov 2025", source: "GARP" },
    },
  };

  static for(ticker: Ticker | null): ExamProfile | null {
    return (ticker && ExamFacts.BY_TICKER[ticker]) || null;
  }
}
