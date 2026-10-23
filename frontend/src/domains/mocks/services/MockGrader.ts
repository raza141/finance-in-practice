import type { ActiveQuestion, MockGrade, MockQuestion, MockResponse, TopicScore } from "../types";

/** Marks an attempt, and decides what of a question a student may see while it is open. */
export class MockGrader {
  /** Seconds after the clock ends that answers still count: the auto-submit's round trip. */
  static readonly GRACE_MS = 30_000;

  /** Whitelisted, so the answer and explanation can never ride along to an open attempt's page. */
  static active(q: MockQuestion | ActiveQuestion): ActiveQuestion {
    return { id: q.id, number: q.number, topic: q.topic, vignette: q.vignette, question: q.question, options: q.options };
  }

  /** One mark per correct answer; no answer scores nothing. Topics in the order they first appear. */
  static grade(questions: readonly MockQuestion[], responses: readonly MockResponse[]): MockGrade {
    const picked = new Map(responses.map((r) => [r.questionId, r.selected]));
    const topics = new Map<string, TopicScore>();
    let score = 0;
    for (const q of questions) {
      const right = picked.get(q.id) === q.correct;
      if (right) score++;
      const t = topics.get(q.topic) ?? { topic: q.topic, correct: 0, total: 0 };
      t.total++;
      if (right) t.correct++;
      topics.set(q.topic, t);
    }
    return { score, total: questions.length, topics: [...topics.values()] };
  }

  /**
   * The final answers: what the browser sent, over what was autosaved. After the clock (`open`
   * false) a sent answer no longer counts, but its flag and notes still do.
   */
  static merge(stored: readonly MockResponse[], sent: readonly MockResponse[], open: boolean): MockResponse[] {
    const out = new Map(stored.map((r) => [r.questionId, r]));
    for (const r of sent) {
      const before = out.get(r.questionId);
      out.set(r.questionId, open ? r : { ...r, selected: before?.selected ?? null });
    }
    return [...out.values()];
  }

  /** Whether answers sent now still count (the clock plus the grace). */
  static open(endsAt: Date, now = new Date()): boolean {
    return now.getTime() <= endsAt.getTime() + MockGrader.GRACE_MS;
  }

  static remainingMs(endsAt: Date, now = new Date()): number {
    return Math.max(0, endsAt.getTime() - now.getTime());
  }

  static percent(score: number, total: number): number {
    return total ? Math.round((score / total) * 100) : 0;
  }

  /** "1:54:22" or "7:05". */
  static clock(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  }
}
