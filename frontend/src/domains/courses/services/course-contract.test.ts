import { describe, expect, it } from "vitest";

import type { AdminUser } from "@/domains/admin/types";

import { COURSE_SEEDS } from "../../../../scripts/db/course-seeds.mts";
import { CourseContract } from "./CourseContract";
import { CourseDraft } from "./CourseDraft";
import { CoursePolicy } from "./CoursePolicy";

const VALID = {
  title: "Fixed income essentials",
  slug: "fixed-income-essentials",
  summary: "Bond pricing, duration, convexity and the yield curve, built in Python.",
  category: "Applied Finance",
  ctaLabel: "Book a free call",
  bookingUrl: "#book",
  coachingLabel: "Code review",
  practiceLabel: "Build",
  weightLabel: "",
  startDate: "2027-02-01",
  duration: "6 weeks · 12 live sessions",
  price: "3,250.5",
  currency: "usd",
  brochureUrl: "/brochures/fixed-income.pdf",
  testimonialTicker: "QUANT",
  method: [{ title: "Prepare", description: "Read first." }],
  modes: [{ title: "Self-study", description: "Read first, bring questions." }],
  modules: [{ title: "Duration", priority: "core", summary: "Rates", coaching: "", practice: "Price a bond", deliverable: "" }],
  options: [{ title: "Per session", description: "", fee: "AED 450", bookingUrl: "" }],
  faqs: [{ question: "Python needed?", answer: "No." }],
};

describe("CourseContract", () => {
  it("parses a valid payload", () => {
    const result = CourseContract.parse(VALID);
    expect(result.ok && result.input).toMatchObject({
      category: "Applied Finance",
      priceMinor: 325050,
      currency: "USD",
      testimonialTicker: "QUANT",
      modules: [{ title: "Duration", priority: "core", summary: "Rates", coaching: "", practice: "Price a bond" }],
      options: [{ title: "Per session", description: "", fee: "AED 450" }],
    });
  });

  it("treats blanks as on request, AED, #book and no ticker", () => {
    const result = CourseContract.parse({ ...VALID, startDate: "", price: " ", currency: "", brochureUrl: "", bookingUrl: "", testimonialTicker: "" });
    expect(result.ok && result.input).toMatchObject({
      startDate: null,
      priceMinor: null,
      currency: "AED",
      brochureUrl: null,
      bookingUrl: "#book",
      testimonialTicker: null,
    });
  });

  it.each([
    ["title", { title: "ab" }],
    ["slug", { slug: "Bad Slug" }],
    ["slug", { slug: "double--hyphen" }],
    ["summary", { summary: "too short" }],
    ["category", { category: "Exam Prep" }],
    ["startDate", { startDate: "2027-02-30" }],
    ["duration", { duration: "x" }],
    ["priceMinor", { price: "12.345" }],
    ["bookingUrl", { bookingUrl: "javascript:alert(1)" }],
    ["bookingUrl", { bookingUrl: "http://insecure.example" }],
    ["brochureUrl", { brochureUrl: "/brochures/../secret.pdf" }],
    ["brochureUrl", { brochureUrl: "https://example.com/not-a-pdf" }],
    ["testimonialTicker", { testimonialTicker: "BTC" }],
    ["method", { method: [{ title: "", description: "untitled" }] }],
    ["method", { method: Array.from({ length: 7 }, () => ({ title: "Step" })) }],
    ["modes", { modes: Array.from({ length: 5 }, () => ({ title: "Way" })) }],
    ["modes", { modes: [{ title: "", description: "untitled" }] }],
    ["modules", { modules: [{ title: "x".repeat(161), priority: "core" }] }],
    ["modules", { modules: [{ title: "Ethics", priority: "urgent" }] }],
    ["modules", { modules: "not a list" }],
    ["options", { options: [{ title: "Single", bookingUrl: "ftp://x" }] }],
    ["faqs", { faqs: [{ question: "Q?", answer: "" }] }],
  ])("rejects a bad %s", (field, patch) => {
    const result = CourseContract.parse({ ...VALID, ...patch });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.errors).toHaveProperty(field);
  });

  it("needs a method step and a module before publishing", () => {
    expect(CourseContract.publishProblems({ method: [], modules: [] })).toHaveProperty("modules");
    expect(CourseContract.publishProblems({ method: [], modules: [] })).toHaveProperty("method");
    const parsed = CourseContract.parse(VALID);
    expect(parsed.ok && CourseContract.publishProblems(parsed.input)).toEqual({});
  });

  it("converts prices between form text and minor units", () => {
    expect(CourseContract.parsePrice("4500")).toBe(450000);
    expect(CourseContract.parsePrice("")).toBeNull();
    expect(CourseContract.priceInput(99950)).toBe("999.50");
  });

  it("slugifies titles", () => {
    expect(CourseContract.slugify("CFA Level I — learn it by doing it")).toBe("cfa-level-i-learn-it-by-doing-it");
    expect(CourseContract.slugify("  Café Économie  ")).toBe("cafe-economie");
  });

  it.each(COURSE_SEEDS.map((seed) => [seed.slug, seed] as const))("accepts the %s seed and it is ready to publish", (_slug, seed) => {
    const result = CourseContract.parse({ ...seed, price: "", currency: "AED", bookingUrl: "#book" });
    expect(result.ok ? CourseContract.publishProblems(result.input) : result.errors).toEqual({});
  });

  it("round-trips a saved course through the editor draft unchanged", () => {
    const parsed = CourseContract.parse(VALID);
    if (!parsed.ok) throw new Error("fixture invalid");
    let key = 0;
    const course = { ...parsed.input, id: "c1", isActive: false };
    const again = CourseContract.parse(CourseDraft.payload(CourseDraft.from(course, () => key++)));
    expect(again).toEqual(parsed);
  });
});

describe("CoursePolicy", () => {
  const admin = (role: AdminUser["role"]) => ({ id: "a", email: "a@x", name: "A", role, hasPassword: true, googleLinked: false });

  it("lets editors work on drafts only", () => {
    expect(CoursePolicy.canSave(admin("editor"), false, false)).toBe(true);
    expect(CoursePolicy.canSave(admin("editor"), false, true)).toBe(false);
    expect(CoursePolicy.canSave(admin("editor"), true, true)).toBe(false);
    expect(CoursePolicy.canSave(admin("editor"), true, false)).toBe(false);
    expect(CoursePolicy.canPublish(admin("editor"))).toBe(false);
    expect(CoursePolicy.canDelete(admin("editor"))).toBe(false);
  });

  it("lets owners do everything", () => {
    expect(CoursePolicy.canSave(admin("owner"), true, true)).toBe(true);
    expect(CoursePolicy.canPublish(admin("owner"))).toBe(true);
  });
});
