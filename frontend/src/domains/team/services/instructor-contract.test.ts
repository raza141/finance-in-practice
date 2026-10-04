import { describe, expect, it } from "vitest";

import { InstructorContract } from "./InstructorContract";

const VALID = {
  name: "Jane Doe",
  role: "Instructor · Financial Modeling",
  bio: "Teaches valuation by building the model live with you.",
  background: "Ten years in equity research.",
  education: "MSc Finance\n\n  CFA charterholder  ",
  highlights: "Valuation, Excel, , DCF",
  photo: "https://example.com/jane.jpg",
  sortOrder: "2",
  isActive: "on",
};

describe("InstructorContract", () => {
  it("parses a valid form", () => {
    expect(InstructorContract.parse(VALID)).toEqual({
      ok: true,
      input: {
        name: "Jane Doe",
        role: "Instructor · Financial Modeling",
        bio: VALID.bio,
        background: "Ten years in equity research.",
        education: ["MSc Finance", "CFA charterholder"],
        highlights: ["Valuation", "Excel", "DCF"],
        photo: "https://example.com/jane.jpg",
        sortOrder: 2,
        isActive: true,
      },
    });
  });

  it("treats blanks as empty, order 0 and unpublished", () => {
    const result = InstructorContract.parse({ ...VALID, background: "", education: "", highlights: "", photo: " ", sortOrder: "", isActive: undefined });
    expect(result.ok && result.input).toMatchObject({ background: "", education: [], highlights: [], photo: null, sortOrder: 0, isActive: false });
  });

  it("accepts a photo from public/team", () => {
    expect(InstructorContract.parse({ ...VALID, photo: "/team/jane.jpg" }).ok).toBe(true);
  });

  it.each([
    ["name", { name: "J" }],
    ["role", { role: "" }],
    ["bio", { bio: "too short" }],
    ["background", { background: "x".repeat(801) }],
    ["education", { education: "x".repeat(161) }],
    ["highlights", { highlights: Array.from({ length: 13 }, (_, i) => `t${i}`).join(",") }],
    ["photo", { photo: "http://example.com/a.jpg" }],
    ["photo", { photo: "javascript:alert(1)" }],
    ["photo", { photo: "/team/../secret.jpg" }],
    ["sortOrder", { sortOrder: "1.5" }],
  ])("rejects a bad %s", (field, patch) => {
    const result = InstructorContract.parse({ ...VALID, ...patch });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toHaveProperty(field);
  });
});
