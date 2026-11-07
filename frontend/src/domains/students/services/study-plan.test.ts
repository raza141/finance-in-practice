import { describe, expect, it } from "vitest";

import { StudyPlanContract } from "./StudyPlanContract";

describe("StudyPlanContract", () => {
  it("reads one topic per line with an optional date and link", () => {
    const result = StudyPlanContract.parseLines("2026-11-03 Ethics https://drive.google.com/file/d/abc\n\nQuant methods\n");
    expect(result).toEqual({
      ok: true,
      value: [
        { startOn: null, dueOn: "2026-11-03", topic: "Ethics", status: "planned", note: "", materialUrl: "https://drive.google.com/file/d/abc", mockId: null },
        { startOn: null, dueOn: null, topic: "Quant methods", status: "planned", note: "", materialUrl: null, mockId: null },
      ],
    });
  });

  it("reads a date range, and refuses one that ends before it starts", () => {
    expect(StudyPlanContract.parseLines("2026-11-01..2026-11-30 Books 1–2")).toMatchObject({ ok: true, value: [{ startOn: "2026-11-01", dueOn: "2026-11-30", topic: "Books 1–2" }] });
    expect(StudyPlanContract.parseLines("2026-11-30..2026-11-01 Books 1–2").ok).toBe(false);
    expect(StudyPlanContract.parseItem({ topic: "Books", status: "planned", startOn: "2026-11-01" }).ok).toBe(false);
  });

  it("lists the books in curriculum order and knows them", () => {
    expect(StudyPlanContract.BOOKS["CFA Level I / II"][0]).toBe("Book 1 · Ethical and Professional Standards");
    expect(StudyPlanContract.BOOKS["CFA Level I / II"]).toHaveLength(10);
    expect(StudyPlanContract.isBook("Book 2 · Quantitative Methods")).toBe(true);
    expect(StudyPlanContract.isBook("Book 99 · Astrology")).toBe(false);
  });

  it("refuses impossible dates and non-https links", () => {
    expect(StudyPlanContract.parseLines("2026-02-31 Ethics")).toEqual({ ok: false, error: "Line 1: Dates are YYYY-MM-DD." });
    expect(StudyPlanContract.parseLines("Ethics http://example.com/x")).toEqual({ ok: false, error: "Line 1: Material links must start with https://." });
    expect(StudyPlanContract.parseItem({ topic: "Ethics", status: "planned", materialUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(StudyPlanContract.parseItem({ topic: "Ethics", status: "lost" }).ok).toBe(false);
  });
});
