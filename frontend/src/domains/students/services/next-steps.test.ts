import { describe, expect, it } from "vitest";

import { Batches } from "./Batches";
import { NextSteps, type NextStepInput } from "./NextSteps";

const now = new Date("2026-11-20T09:00:00Z");
const base: NextStepInput = {
  ended: [{ course: "CFA Level I", label: "Nov 2026", ends: "2026-11-15", paused: false, examDate: "2026-11-10" }],
  live: [],
  enrolled: ["CFA Level I"],
  courses: [
    { title: "CFA Level I", ticker: "CFA1" },
    { title: "CFA Level II", ticker: "CFA2" },
    { title: "Financial Modeling", ticker: "QUANT" },
  ],
  results: [],
  pending: [],
  opened: {},
  now,
};

describe("NextSteps", () => {
  it("asks for the result and lets a confident student start Level II early", () => {
    expect(NextSteps.steps(base)).toEqual([
      { kind: "result", course: "CFA Level I", label: "Nov 2026" },
      { kind: "move", course: "CFA Level II", retake: false, sittings: ["May 2027", "Aug 2027", "Nov 2027"] },
    ]);
  });

  it("offers a retake six months on after a fail, and no Level II", () => {
    const steps = NextSteps.steps({ ...base, results: [{ course: "CFA Level I", label: "Nov 2026", passed: false }] });
    expect(steps).toEqual([{ kind: "move", course: "CFA Level I", retake: true, sittings: ["May 2027", "Aug 2027", "Nov 2027"] }]);
  });

  it("skips the next window for a CFA retake", () => {
    const aug = new Date("2026-08-25T09:00:00Z");
    expect(Batches.retake(Batches.windows("CFA1")!, [], "2026-08-15", aug)).toEqual(["Feb 2027", "May 2027", "Aug 2027"]);
    // Feb 20 + six months is Aug 20, after the Aug window's start: compared by month, Aug still counts.
    expect(Batches.retake(Batches.windows("CFA1")!, [], "2027-02-20", new Date("2027-04-01T09:00:00Z"))).toEqual(["Aug 2027", "Nov 2027"]);
  });

  it("shows a waiting row instead of the move once asked, and nothing for a paused course", () => {
    const steps = NextSteps.steps({
      ...base,
      ended: [...base.ended, { course: "CFA Level II", label: "May 2027", ends: "2026-11-18", paused: true, examDate: "2027-05-15" }],
      results: [{ course: "CFA Level I", label: "Nov 2026", passed: true }],
      pending: [{ course: "CFA Level II", label: "May 2027", retake: false }],
    });
    expect(steps).toEqual([{ kind: "waiting", course: "CFA Level II", label: "May 2027", retake: false }]);
  });

  it("accepts only what was offered", () => {
    expect(NextSteps.allowed(base, { course: "CFA Level II", label: "May 2027", retake: false })).toBe(true);
    expect(NextSteps.allowed(base, { course: "CFA Level II", label: "Nov 2026", retake: false })).toBe(false);
    expect(NextSteps.allowed(base, { course: "CFA Level I", label: "May 2027", retake: true })).toBe(false);
    expect(NextSteps.allowed(base, { course: "Financial Modeling", label: "", retake: false })).toBe(true);
    expect(NextSteps.addable({ ...base, enrolled: ["CFA Level I", "Financial Modeling"] }).map((a) => a.course)).toEqual(["CFA Level II"]);
  });

  it("takes 10% off a retake package", () => {
    expect(NextSteps.retakePrice(500000)).toBe(450000);
  });
});
