import { describe, expect, it } from "vitest";

import { CourseContract } from "./CourseContract";

const VALID = {
  title: "Fixed income essentials",
  slug: "fixed-income-essentials",
  summary: "Bond pricing, duration, convexity and the yield curve, built in Python.",
  category: "Fixed Income",
  startDate: "2027-02-01",
  duration: "6 weeks · 12 live sessions",
  price: "3,250.5",
  currency: "usd",
  brochureUrl: "/brochures/fixed-income.pdf",
  isActive: "on",
  syllabus: JSON.stringify([{ title: "Duration", topics: ["Macaulay", "Modified"] }]),
};

describe("CourseContract", () => {
  it("parses a valid form", () => {
    expect(CourseContract.parse(VALID)).toEqual({
      ok: true,
      input: {
        title: "Fixed income essentials",
        slug: "fixed-income-essentials",
        summary: VALID.summary,
        category: "Fixed Income",
        startDate: "2027-02-01",
        duration: "6 weeks · 12 live sessions",
        priceMinor: 325050,
        currency: "USD",
        brochureUrl: "/brochures/fixed-income.pdf",
        isActive: true,
        syllabus: [{ title: "Duration", topics: ["Macaulay", "Modified"] }],
      },
    });
  });

  it("treats blanks as on request, AED and unpublished", () => {
    const result = CourseContract.parse({ ...VALID, startDate: "", price: " ", currency: "", brochureUrl: "", isActive: undefined, syllabus: "" });
    expect(result.ok && result.input).toMatchObject({
      startDate: null,
      priceMinor: null,
      currency: "AED",
      brochureUrl: null,
      isActive: false,
      syllabus: [],
    });
  });

  it.each([
    ["title", { title: "ab" }],
    ["slug", { slug: "Bad Slug" }],
    ["slug", { slug: "double--hyphen" }],
    ["summary", { summary: "too short" }],
    ["category", { category: "Crypto" }],
    ["startDate", { startDate: "2027-02-30" }],
    ["duration", { duration: "x" }],
    ["priceMinor", { price: "12.345" }],
    ["priceMinor", { price: "-5" }],
    ["brochureUrl", { brochureUrl: "https://evil.example/a.pdf" }],
    ["brochureUrl", { brochureUrl: "/brochures/../secret.pdf" }],
    ["syllabus", { syllabus: "{not json" }],
    ["syllabus", { syllabus: JSON.stringify([{ title: "x".repeat(161), topics: [] }]) }],
  ])("rejects a bad %s", (field, patch) => {
    const result = CourseContract.parse({ ...VALID, ...patch });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toHaveProperty(field);
  });

  it("converts prices between form text and minor units", () => {
    expect(CourseContract.parsePrice("4500")).toBe(450000);
    expect(CourseContract.parsePrice("0")).toBe(0);
    expect(CourseContract.parsePrice("")).toBeNull();
    expect(CourseContract.priceInput(450000)).toBe("4500");
    expect(CourseContract.priceInput(99950)).toBe("999.50");
    expect(CourseContract.priceInput(null)).toBe("");
  });

  it("slugifies titles", () => {
    expect(CourseContract.slugify("Portfolio Construction & ML (2027)")).toBe("portfolio-construction-ml-2027");
    expect(CourseContract.slugify("  Café Économie  ")).toBe("cafe-economie");
  });
});
