import { describe, expect, it } from "vitest";

import type { Mark } from "../types";
import { OnTrack } from "./OnTrack";

const right = (percent: number, difficulty: Mark["difficulty"] = "medium"): Mark[] => [{ difficulty, correct: percent, total: 100 }];
const score = (over: Partial<Parameters<typeof OnTrack.score>[0]> = {}) =>
  OnTrack.score({ hoursDone: 150, targetHours: 300, elapsed: 50, total: 100, chapters: { touched: 25, total: 50 }, marks: right(70), ...over });

describe("OnTrack", () => {
  it("is 100 on plan", () => expect(score()).toMatchObject({ score: 100, band: "on_track" }));
  it("is 80 at 80% of everything", () =>
    expect(score({ hoursDone: 120, chapters: { touched: 20, total: 50 }, marks: right(56) })).toMatchObject({ score: 80, band: "on_track" }));
  it("doesn't let extra hours hide no coverage", () =>
    expect(score({ hoursDone: 180, chapters: { touched: 0, total: 50 }, marks: right(77) })).toMatchObject({ score: 72, band: "slipping" }));
  it("keeps guessing out of green", () =>
    expect(score({ hoursDone: 180, chapters: { touched: 30, total: 50 }, marks: right(33) })).toMatchObject({ score: 79, band: "slipping" }));
  it("keeps no answers in 14 days out of green", () => expect(score({ marks: [] })).toMatchObject({ score: 79, accuracy: null }));
  it("needs 60% coverage for green", () => {
    expect(score({ chapters: { touched: 14, total: 50 }, marks: right(77) }).band).toBe("slipping");
    expect(score({ chapters: { touched: 15, total: 50 }, marks: right(77) }).band).toBe("on_track");
  });
  it("is red well behind", () => expect(score({ hoursDone: 0, marks: right(77) })).toMatchObject({ score: 52, band: "at_risk" }));
  it("doesn't divide by zero on day one, with no exam or no chapters", () => {
    expect(score({ hoursDone: 0, elapsed: 0, chapters: { touched: 0, total: 50 } }).score).toBe(100);
    expect(score({ hoursDone: 0, elapsed: 0, total: 0 }).score).toBe(100);
    expect(score({ chapters: { touched: 0, total: 0 } }).score).toBe(100);
  });
  it("holds easy questions to 80%, and caps hard ones at 100%", () => {
    expect(OnTrack.accuracy(right(100, "easy"))).toBeCloseTo(0.8);
    expect(OnTrack.accuracy(right(100, "hard"))).toBe(1);
    expect(OnTrack.accuracy(right(60, ""))).toBeCloseTo(0.6);
    expect(OnTrack.plainAccuracy(right(100, "easy"))).toBe(1);
  });
  it("puts the bands at 80 and 60", () => expect([80, 79, 60, 59].map(OnTrack.band)).toEqual(["on_track", "slipping", "slipping", "at_risk"]));
});
