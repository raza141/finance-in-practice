import { describe, expect, it } from "vitest";

import { TestimonialContract } from "./TestimonialContract";

describe("TestimonialContract.parseEdit (admin corrections)", () => {
  const base = {
    author: "Ayesha Khan",
    context: "CFA Level I candidate",
    city: "Abu Dhabi",
    country: "United Arab Emirates",
    quote: "x".repeat(60),
  };

  it("fixes a misspelt name and tidies whitespace", () => {
    expect(TestimonialContract.parseEdit({ ...base, author: "  Aysha   Khan " }).author).toBe("Aysha Khan");
  });

  it("lets older testimonials keep an empty location", () => {
    const edit = TestimonialContract.parseEdit({ ...base, city: "", country: "  " });
    expect(edit.city).toBeNull();
    expect(edit.country).toBeNull();
  });

  it("applies the public form's limits", () => {
    expect(() => TestimonialContract.parseEdit({ ...base, author: "A" })).toThrow(/name must be/);
    expect(() => TestimonialContract.parseEdit({ ...base, quote: "too short" })).toThrow(/note must be/);
    expect(() => TestimonialContract.parseEdit({ ...base, city: "X" })).toThrow(/city must be/);
  });

  it("still requires a location on public submissions", () => {
    expect(() => TestimonialContract.parseEdit({ ...base, city: "" }, { requireLocation: true })).toThrow(/city must be/);
  });
});
