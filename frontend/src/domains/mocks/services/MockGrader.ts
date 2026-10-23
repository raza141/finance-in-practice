import type { ActiveQuestion, MockGrade, MockQuestion, MockResponse, TopicScore } from "../types";

/** Marks an attempt, and decides what of a question a student may see while it is open. */
export class MockGrader {
  /**
   * The order an attempt shows its questions in, numbered 1…n by position. `seed` null (a first
   * attempt): the mock's own order. A retake passes its attempt id, so every retake gets its own
   * order that stays the same on refresh and in its results. Questions sharing a vignette stay
   * together in their own order; the options never move (an answer can be "A and B").
   */
  static arrange<T extends { id: string; number: number; vignette: string }>(questions: readonly T[], seed: string | null): T[] {
    const groups: T[][] = [];
    for (const q of questions) {
      const last = groups.at(-1);
      if (q.vignette && last?.[0].vignette === q.vignette) last.push(q);
      else groups.push([q]);
    }
    const key = (g: T[]) => MockGrader.hash(`${seed}:${g[0].id}`);
    const ordered = seed === null ? groups : [...groups].sort((a, b) => key(a) - key(b));
    return ordered.flat().map((q, i) => ({ ...q, number: i + 1 }));
  }

  /** FNV-1a, 32-bit: a stable shuffle key, not security. */
  private static hash(text: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h >>> 0;
  }

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
