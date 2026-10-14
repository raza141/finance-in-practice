import { describe, expect, it } from "vitest";

import { RegistrationContract } from "./RegistrationContract";

const COURSES = ["CFA Level I", "FRM Part I"];
const VALID = { name: " Ali  Kenan ", email: "Ali.Kenan@Gmail.com", phone: "+971 50 123 4567", course: "CFA Level I" };

describe("RegistrationContract", () => {
  it("normalises a valid sign-up", () => {
    expect(RegistrationContract.parse(VALID, COURSES)).toEqual({
      ok: true,
      spam: false,
      value: { name: "Ali Kenan", email: "ali.kenan@gmail.com", phone: "+971 50 123 4567", course: "CFA Level I" },
    });
    const other = RegistrationContract.parse({ ...VALID, course: "Other", topic: "AP Statistics" }, COURSES);
    expect(other.ok && other.value.course).toBe("Other: AP Statistics");
    const consultancy = RegistrationContract.parse({ ...VALID, course: "Business consultancy" }, COURSES);
    expect(consultancy.ok && consultancy.value.course).toBe("Business consultancy");
  });

  it.each([
    ["a course that isn't published", { course: "Academic Mentorship Program" }],
    ["Other without a topic", { course: "Other", topic: "" }],
    ["a bad email", { email: "ali@" }],
    ["a short phone", { phone: "12345" }],
    ["letters in the phone", { phone: "+971 call me" }],
    ["no name", { name: " " }],
  ])("refuses %s", (_, patch) => {
    expect(RegistrationContract.parse({ ...VALID, ...patch }, COURSES).ok).toBe(false);
  });

  it("flags the honeypot without failing", () => {
    expect(RegistrationContract.parse({ ...VALID, website: "spam.example" }, COURSES)).toMatchObject({ ok: true, spam: true });
  });
});
