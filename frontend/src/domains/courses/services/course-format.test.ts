import { describe, expect, it } from "vitest";

import { CourseFormat } from "./CourseFormat";

describe("CourseFormat", () => {
  it("formats fees from minor units", () => {
    expect(CourseFormat.price({ priceMinor: 450000, currency: "AED" })).toBe("AED 4,500");
    expect(CourseFormat.price({ priceMinor: 99950, currency: "USD" })).toBe("USD 999.50");
    expect(CourseFormat.price({ priceMinor: 0, currency: "AED" })).toBe("Free");
    expect(CourseFormat.price({ priceMinor: null, currency: "AED" })).toBe("On request");
  });

  it("formats start dates as calendar dates", () => {
    expect(CourseFormat.startDate("2027-01-12")).toBe("12 January 2027");
    expect(CourseFormat.startDate(null)).toBe("On request");
  });

  it("keeps only well-formed modules, defaulting an unknown priority to core", () => {
    expect(
      CourseFormat.modules([
        { title: " Fixed Income ", priority: "high_priority", summary: "Yield", coaching: "c", practice: "p", deliverable: " " },
        { title: "", priority: "core" },
        "junk",
        null,
        { title: "Ethics", priority: "urgent" },
      ]),
    ).toEqual([
      { title: "Fixed Income", priority: "high_priority", summary: "Yield", coaching: "c", practice: "p" },
      { title: "Ethics", priority: "core", summary: "", coaching: "", practice: "" },
    ]);
    expect(CourseFormat.modules({ not: "an array" })).toEqual([]);
  });

  it("drops FAQs missing a question or answer, and untitled steps and options", () => {
    expect(CourseFormat.faqs([{ question: "Q", answer: "" }, { question: "Q2", answer: "A2" }])).toEqual([{ question: "Q2", answer: "A2" }]);
    expect(CourseFormat.method([{ description: "no title" }, { title: "Apply" }])).toEqual([{ title: "Apply", description: "" }]);
    expect(CourseFormat.options([{ title: "Single", fee: "Free", bookingUrl: "" }])).toEqual([{ title: "Single", description: "", fee: "Free" }]);
  });

  it("splits the difference into headline and body, and spells small counts", () => {
    expect(CourseFormat.splitFirstLine("Not a lecture.\nBring your attempt.")).toEqual({ headline: "Not a lecture.", body: "Bring your attempt." });
    expect(CourseFormat.splitFirstLine("One line")).toEqual({ headline: "One line", body: "" });
    expect(CourseFormat.count(3)).toBe("three");
    expect(CourseFormat.count(12)).toBe("12");
  });
});
