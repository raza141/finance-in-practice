import type { Progress, Score } from "@/domains/classroom/services/ClassFeed";

import type { TopicMark } from "../types";
import { MockGrader } from "./MockGrader";

/**
 * The Progress tab from the student's own mock attempts (every retake counts): each attempt is a
 * mark, and each topic's trend is that topic's share right in every attempt that had it. A topic is
 * matched ignoring case and spaces at the ends, so "FSA" and "fsa " are one line. Pure.
 */
export class MockProgress {
  static build(rows: readonly TopicMark[]): Progress {
    const attempts = new Map<string, { title: string; at: string; correct: number; total: number }>();
    const topics = new Map<string, { name: string; correct: number; total: number; scores: Score[] }>();
    for (const r of rows) {
      const a = attempts.get(r.attemptId) ?? { title: r.title, at: r.at, correct: 0, total: 0 };
      a.correct += r.correct;
      a.total += r.total;
      attempts.set(r.attemptId, a);
      const key = r.topic.trim().toLowerCase();
      const t = topics.get(key) ?? { name: r.topic.trim(), correct: 0, total: 0, scores: [] };
      t.correct += r.correct;
      t.total += r.total;
      t.scores.push({ id: r.attemptId, title: r.title, pct: MockGrader.percent(r.correct, r.total), at: r.at, link: `/student/mocks/${r.attemptId}` });
      topics.set(key, t);
    }
    const mocks: Score[] = [...attempts].map(([id, a]) => ({ id, title: a.title, pct: MockGrader.percent(a.correct, a.total), at: a.at, link: `/student/mocks/${id}` }));
    const pcts = mocks.map((m) => m.pct);
    const average = pcts.length ? Math.round(pcts.reduce((s, p) => s + p, 0) / pcts.length) : null;
    const best = pcts.length ? Math.max(...pcts) : null;
    return {
      mocks,
      latest: pcts.at(-1) ?? null,
      average,
      best,
      change: pcts.length >= 2 ? pcts.at(-1)! - pcts[0] : null,
      // Weakest first: where a review session helps most.
      topics: [...topics.values()]
        .map((t) => ({ name: t.name, pct: MockGrader.percent(t.correct, t.total), count: t.scores.length, scores: t.scores }))
        .sort((a, b) => a.pct - b.pct || a.name.localeCompare(b.name)),
      overall: { last: mocks.at(-1) ?? null, average, best, count: mocks.length },
    };
  }
}
