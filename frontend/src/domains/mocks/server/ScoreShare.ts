import "server-only";

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** What a shared score shows. No name, email or attempt id: only what the student chose to post. */
export interface SharedScore {
  /** The mock's title, e.g. "CFA® Level I Mock 3". */
  title: string;
  score: number;
  total: number;
  /** YYYY-MM-DD the attempt was submitted (UAE time). */
  date: string;
}

/**
 * The public link behind "Share on LinkedIn" on a mock's results: the score is in the URL itself,
 * signed so nobody can edit it to 100%. No database row, so a shared link never expires and leaks nothing.
 * Key derived from GOOGLE_CLIENT_SECRET under its own label (as EmailLink), so one token can't pass as the other.
 */
export class ScoreShare {
  static readonly PATH = "/share/score";

  constructor(private readonly key: Buffer) {}

  static fromEnv(env: NodeJS.ProcessEnv = process.env): ScoreShare | null {
    const secret = env.GOOGLE_CLIENT_SECRET?.trim();
    return secret ? new ScoreShare(createHash("sha256").update(`fip-score-share|${secret}`).digest()) : null;
  }

  issue(s: SharedScore): string {
    const body = Buffer.from(JSON.stringify([s.title.slice(0, 80), s.score, s.total, s.date])).toString("base64url");
    return `${body}.${this.sign(body)}`;
  }

  /** The score, or null when the token is missing, forged or malformed. */
  read(value: string | null | undefined): SharedScore | null {
    const [body, signature, extra] = (value ?? "").split(".");
    if (!body || !signature || extra !== undefined) return null;
    const expected = Buffer.from(this.sign(body));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const [title, score, total, date] = JSON.parse(Buffer.from(body, "base64url").toString()) as unknown[];
      if (typeof title !== "string" || typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      if (!Number.isInteger(score) || !Number.isInteger(total) || (total as number) < 1 || (score as number) < 0 || (score as number) > (total as number)) return null;
      return { title, score: score as number, total: total as number, date };
    } catch {
      return null;
    }
  }

  private sign(body: string): string {
    return createHmac("sha256", this.key).update(body).digest("base64url").slice(0, 22);
  }
}
