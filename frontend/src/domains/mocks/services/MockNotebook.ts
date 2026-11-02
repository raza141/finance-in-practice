import type { CfaLevel, NotebookEntry, OptionLetter } from "../types";

/** One answer the student gave, in a closed attempt. `key` is the bank question however many copies it has. */
export interface NotebookRow extends Omit<NotebookEntry, "lastWrong" | "timesWrong" | "streak" | "at"> {
  key: string;
  level: CfaLevel;
  selected: OptionLetter | null;
  at: Date;
}

/** The mistakes notebook: every question a student has got wrong (or left blank), until they get it right twice in a row. */
export class MockNotebook {
  static readonly RIGHT_TO_CLEAR = 2;

  /** `rows` oldest first. Newest-met first, so what they just missed is at the top. */
  static build(rows: readonly NotebookRow[]): NotebookEntry[] {
    const seen = new Map<string, NotebookEntry>();
    for (const { key, selected, at, ...q } of rows) {
      const before = seen.get(key);
      const right = selected === q.correct;
      seen.set(key, {
        ...q,
        timesWrong: (before?.timesWrong ?? 0) + (right ? 0 : 1),
        streak: right ? (before?.streak ?? 0) + 1 : 0,
        lastWrong: right ? (before?.lastWrong ?? null) : selected,
        at: at.toISOString(),
      });
    }
    return [...seen.values()].filter((e) => e.timesWrong > 0 && e.streak < MockNotebook.RIGHT_TO_CLEAR).sort((a, b) => b.at.localeCompare(a.at));
  }

  /** A notebook practice run: the newest `max`, then grouped by topic and case so an item set's questions sit together. */
  static practice(book: readonly NotebookEntry[], max = MockNotebook.PRACTICE_MAX): NotebookEntry[] {
    return book.slice(0, max).sort((a, b) => a.topic.localeCompare(b.topic) || a.vignette.localeCompare(b.vignette));
  }

  static readonly PRACTICE_MAX = 30;
}
