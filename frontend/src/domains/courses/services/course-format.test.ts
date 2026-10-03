import { describe, expect, it } from "vitest";

import { CourseFormat } from "./CourseFormat";

describe("CourseFormat", () => {
  it("formats fees from minor units", () => {
    expect(CourseFormat.price({ priceMinor: 450000, currency: "AED" })).toBe("AED\u00a04,500");
    expect(CourseFormat.price({ priceMinor: 99950, currency: "USD" })).toBe("USD\u00a0999.50");
    expect(CourseFormat.price({ priceMinor: 0, currency: "AED" })).toBe("Free");
    expect(CourseFormat.price({ priceMinor: null, currency: "AED" })).toBe("On request");
  });

  it("formats start dates as calendar dates", () => {
    expect(CourseFormat.startDate("2027-01-12")).toBe("12 January 2027");
    expect(CourseFormat.startDate(null)).toBe("On request");
  });

  it("keeps only well-formed syllabus modules", () => {
    expect(
      CourseFormat.syllabus([
        { title: " Risk budgeting ", summary: "", topics: ["HRP", 3, " ", "Shrinkage "] },
        { title: "", topics: [] },
        { summary: "no title" },
        "junk",
        null,
        { title: "Backtesting" },
      ]),
    ).toEqual([
      { title: "Risk budgeting", topics: ["HRP", "Shrinkage"] },
      { title: "Backtesting", topics: [] },
    ]);
    expect(CourseFormat.syllabus({ not: "an array" })).toEqual([]);
  });

  it("counts topics", () => {
    expect(CourseFormat.topicCount([{ title: "a", topics: ["x", "y"] }, { title: "b", topics: ["z"] }])).toBe(3);
  });
});
