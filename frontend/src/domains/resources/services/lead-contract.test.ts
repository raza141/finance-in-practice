import { describe, expect, it } from "vitest";

import { LeadContract, LeadValidationError } from "./LeadContract";

describe("LeadContract", () => {
  it("normalises the email and resolves the resource", () => {
    const lead = LeadContract.parse({ email: "  Sam@Example.COM ", resource: "cfa1-exam-map", source: "home", marketingOptIn: true });
    expect(lead.email).toBe("sam@example.com");
    expect(lead.resource.file).toMatch(/\.pdf$/);
    expect(lead.marketingOptIn).toBe(true);
  });

  it("keeps marketing opt-in off unless explicitly true", () => {
    expect(LeadContract.parse({ email: "a@b.co", resource: "cfa1-exam-map", marketingOptIn: "yes" }).marketingOptIn).toBe(false);
  });

  it("rejects bad emails and unknown resources", () => {
    expect(() => LeadContract.parse({ email: "nope", resource: "cfa1-exam-map" })).toThrow(LeadValidationError);
    expect(() => LeadContract.parse({ email: "a@b.co", resource: "missing" })).toThrow(LeadValidationError);
    expect(() => LeadContract.parse(null)).toThrow(LeadValidationError);
  });
});
