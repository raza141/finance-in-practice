/** One answered diagnostic question: its topic, the right option and what was picked (null: skipped). */
export interface DiagnosticAnswer {
  topic: string;
  correct: number;
  picked: number | null;
}

export interface DiagnosticTopic {
  topic: string;
  right: number;
  total: number;
}

/** The free diagnostic's result: a score, and every topic weakest first, so the plan starts where the marks are lost. Pure; runs in the browser. */
export class DiagnosticScore {
  static of(answers: readonly DiagnosticAnswer[]): { score: number; total: number; topics: DiagnosticTopic[] } {
    const topics = new Map<string, DiagnosticTopic>();
    let score = 0;
    for (const a of answers) {
      const t = topics.get(a.topic) ?? { topic: a.topic, right: 0, total: 0 };
      t.total++;
      if (a.picked === a.correct) {
        t.right++;
        score++;
      }
      topics.set(a.topic, t);
    }
    const sorted = [...topics.values()].sort((x, y) => x.right / x.total - y.right / y.total);
    return { score, total: answers.length, topics: sorted };
  }
}
