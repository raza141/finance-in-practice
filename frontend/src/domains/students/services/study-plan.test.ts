import { describe, expect, it } from "vitest";

import { StudyPlanContract } from "./StudyPlanContract";

describe("StudyPlanContract", () => {
  it("reads one topic per line with an optional date and link", () => {
    const result = StudyPlanContract.parseLines("2026-11-03 Ethics https://drive.google.com/file/d/abc\n\nQuant methods\n");
    expect(result).toEqual({
      ok: true,
      value: [
        { dueOn: "2026-11-03", topic: "Ethics", status: "planned", note: "", materialUrl: "https://drive.google.com/file/d/abc" },
        { dueOn: null, topic: "Quant methods", status: "planned", note: "", materialUrl: null },
      ],
    });
  });

  it("refuses impossible dates and non-https links", () => {
    expect(StudyPlanContract.parseLines("2026-02-31 Ethics")).toEqual({ ok: false, error: "Line 1: Dates are YYYY-MM-DD." });
    expect(StudyPlanContract.parseLines("Ethics http://example.com/x")).toEqual({ ok: false, error: "Line 1: Material links must start with https://." });
    expect(StudyPlanContract.parseItem({ topic: "Ethics", status: "planned", materialUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(StudyPlanContract.parseItem({ topic: "Ethics", status: "lost" }).ok).toBe(false);
  });
});
