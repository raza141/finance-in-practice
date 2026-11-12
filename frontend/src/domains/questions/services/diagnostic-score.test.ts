import { describe, expect, it } from "vitest";

import { DiagnosticScore } from "./DiagnosticScore";

describe("DiagnosticScore", () => {
  it("scores and lists topics weakest first; a skip counts as wrong", () => {
    const r = DiagnosticScore.of([
      { topic: "ethics", correct: 0, picked: 0 },
      { topic: "fixed-income", correct: 1, picked: 2 },
      { topic: "fixed-income", correct: 2, picked: 2 },
      { topic: "derivatives", correct: 1, picked: null },
    ]);
    expect(r.score).toBe(2);
    expect(r.total).toBe(4);
    expect(r.topics.map((t) => t.topic)).toEqual(["derivatives", "fixed-income", "ethics"]);
    expect(r.topics[1]).toEqual({ topic: "fixed-income", right: 1, total: 2 });
  });

  it("handles no answers", () => {
    expect(DiagnosticScore.of([])).toEqual({ score: 0, total: 0, topics: [] });
  });
});
