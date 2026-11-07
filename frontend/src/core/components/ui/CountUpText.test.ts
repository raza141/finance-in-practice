import { describe, expect, it } from "vitest";

import { countUpFrame } from "./CountUpText";

describe("countUpFrame", () => {
  it("keeps the figure's format while counting", () => {
    expect(countUpFrame("AED 2,000.00 to pay", 0)).toBe("AED 0.00 to pay");
    expect(countUpFrame("12.5 h left", 0)).toBe("0.0 h left");
    expect(countUpFrame("AED 1,500.00 in credit", 0.5)).toBe(
      "AED 1,406.25 in credit",
    );
  });
  it("ends on the exact text, and leaves text without a number alone", () => {
    expect(countUpFrame("AED 2,000.00 to pay", 1)).toBe("AED 2,000.00 to pay");
    expect(countUpFrame("All paid", 0.3)).toBe("All paid");
  });
});
