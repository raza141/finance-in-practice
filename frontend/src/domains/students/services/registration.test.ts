import { describe, expect, it } from "vitest";

import { RegistrationContract } from "./RegistrationContract";

const COURSES = ["CFA Level I", "FRM Part I"];
const VALID = { name: " Ali  Kenan ", email: "Ali.Kenan@Gmail.com", phone: "+971 50 123 4567", course: "CFA Level I" };

describe("RegistrationContract", () => {
  it("normalises a valid sign-up", () => {
    expect(RegistrationContract.parse(VALID, COURSES)).toEqual({
      ok: true,
      spam: false,
      value: { name: "Ali Kenan", email: "ali.kenan@gmail.com", phone: "+971 50 123 4567", course: "CFA Level I", batch: "" },
    });
    const other = RegistrationContract.parse({ ...VALID, course: "Other", topic: "AP Statistics" }, COURSES);
    expect(other.ok && other.value.course).toBe("Other: AP Statistics");
    const consultancy = RegistrationContract.parse({ ...VALID, course: "Business consultancy" }, COURSES);
    expect(consultancy.ok && consultancy.value.course).toBe("Business consultancy");
  });

  it("requires an offered sitting, or Not sure yet, for an exam course", () => {
    const batches = { "CFA Level I": ["Nov 2026", "Feb 2027"] };
    const pick = (batch: string) => RegistrationContract.parse({ ...VALID, batch }, COURSES, batches);
    expect(pick("Feb 2027")).toMatchObject({ ok: true, value: { batch: "Feb 2027" } });
    expect(pick("Not sure yet")).toMatchObject({ ok: true, value: { batch: "Not sure yet" } });
    expect(pick("").ok).toBe(false);
    expect(pick("May 2031").ok).toBe(false);
    // Not an exam course: any sent batch is dropped.
    expect(RegistrationContract.parse({ ...VALID, course: "FRM Part I", batch: "x" }, COURSES, batches)).toMatchObject({ ok: true, value: { batch: "" } });
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
