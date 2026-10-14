import { describe, expect, it } from "vitest";

import { ClassroomLink } from "./ClassroomLink";

describe("ClassroomLink", () => {
  it("accepts Classroom invites only", () => {
    expect(ClassroomLink.isValid("https://classroom.google.com/c/NzQxMjM0?cjc=abc123")).toBe(true);
    expect(ClassroomLink.isValid("http://classroom.google.com/c/NzQ")).toBe(false);
    expect(ClassroomLink.isValid("https://classroom.google.com.evil.example/c/x")).toBe(false);
    expect(ClassroomLink.isValid("https://classroom.google.com/")).toBe(false);
  });
});
