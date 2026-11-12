import { describe, expect, it } from "vitest";

import { ScoreShare } from "./ScoreShare";

describe("ScoreShare", () => {
  const share = ScoreShare.fromEnv({ GOOGLE_CLIENT_SECRET: "test-secret" } as unknown as NodeJS.ProcessEnv)!;
  const score = { title: "CFA® Level I Mock 3", score: 61, total: 90, date: "2026-11-12" };

  it("reads back what it issued", () => {
    expect(share.read(share.issue(score))).toEqual(score);
  });

  it("rejects an edited score", () => {
    const [, sig] = share.issue(score).split(".");
    const forged = Buffer.from(JSON.stringify([score.title, 90, 90, score.date])).toString("base64url");
    expect(share.read(`${forged}.${sig}`)).toBeNull();
  });

  it("rejects another key, junk and impossible scores", () => {
    const other = ScoreShare.fromEnv({ GOOGLE_CLIENT_SECRET: "other" } as unknown as NodeJS.ProcessEnv)!;
    expect(other.read(share.issue(score))).toBeNull();
    expect(share.read("nope")).toBeNull();
    expect(share.read(null)).toBeNull();
    expect(share.read(share.issue({ ...score, score: 91 }))).toBeNull();
  });

  it("needs the secret", () => {
    expect(ScoreShare.fromEnv({} as unknown as NodeJS.ProcessEnv)).toBeNull();
  });
});
