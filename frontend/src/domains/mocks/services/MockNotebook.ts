import type { CfaLevel, NotebookEntry, OptionLetter } from "../types";

/** One answer the student gave, in a closed attempt. `key` is the bank question however many copies it has. */
export interface NotebookRow extends Omit<NotebookEntry, "lastWrong" | "timesWrong" | "timesFlagged" | "streak" | "at"> {
  key: string;
  level: CfaLevel;
  selected: OptionLetter | null;
  /** Flagged in that attempt: right but unsure counts as a miss. */
  flagged: boolean;
  at: Date;
}

/** The mistakes notebook: every question a student has got wrong, left blank or flagged, until they get it right (unflagged) twice in a row. */
export class MockNotebook {
  static readonly RIGHT_TO_CLEAR = 2;

  /** `rows` oldest first. Newest-met first, so what they just missed is at the top. */
  static build(rows: readonly NotebookRow[]): NotebookEntry[] {
    const seen = new Map<string, NotebookEntry>();
    for (const { key, selected, flagged, at, ...q } of rows) {
      const before = seen.get(key);
      const right = selected === q.correct;
      const sure = right && !flagged;
      seen.set(key, {
        ...q,
        timesWrong: (before?.timesWrong ?? 0) + (right ? 0 : 1),
        timesFlagged: (before?.timesFlagged ?? 0) + (right && flagged ? 1 : 0),
        streak: sure ? (before?.streak ?? 0) + 1 : 0,
        lastWrong: right ? (before?.lastWrong ?? null) : selected,
        at: at.toISOString(),
      });
    }
    return [...seen.values()].filter((e) => e.timesWrong + e.timesFlagged > 0 && e.streak < MockNotebook.RIGHT_TO_CLEAR).sort((a, b) => b.at.localeCompare(a.at));
  }

  /** A notebook practice run: the newest `max`, then grouped by topic and case so an item set's questions sit together. */
  static practice(book: readonly NotebookEntry[], max = MockNotebook.PRACTICE_MAX): NotebookEntry[] {
    return book.slice(0, max).sort((a, b) => a.topic.localeCompare(b.topic) || a.vignette.localeCompare(b.vignette));
  }

  static readonly PRACTICE_MAX = 30;
}
