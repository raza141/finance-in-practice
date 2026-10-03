import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as submitRoute } from "@/app/api/testimonials/route";

import { TestimonialContract, TestimonialValidationError, type TestimonialSubmission } from "../services/TestimonialContract";
import type { TestimonialStatus } from "../types";
import { TestimonialRepository, type TestimonialStore } from "./TestimonialRepository";

const ORIGIN = "https://financeinpractice.me";

const VALID = {
  author: "  Ada   Lovelace ",
  email: " Ada@Example.com ",
  context: "CFA Level I candidate",
  program: "CFA® exam prep",
  quote: "The sessions turned formulas I had memorised into intuition.\r\n\r\n\r\nI passed on my first attempt.",
  outcome: "Passed CFA Level I, May 2026",
  consent: true,
};

// --------------------------------------------------------------------------

describe("TestimonialContract", () => {
  it("normalises a valid submission", () => {
    expect(TestimonialContract.parseSubmission(VALID)).toEqual({
      author: "Ada Lovelace",
      email: "ada@example.com",
      context: "CFA Level I candidate",
      program: "CFA® exam prep",
      quote: "The sessions turned formulas I had memorised into intuition.\n\nI passed on my first attempt.",
      outcome: "Passed CFA Level I, May 2026",
      website: "",
    });
  });

  it("treats a blank outcome as absent", () => {
    expect(TestimonialContract.parseSubmission({ ...VALID, outcome: "   " }).outcome).toBeNull();
  });

  it.each([
    [{ author: "A" }, /name/],
    [{ email: "not-an-email" }, /email/],
    [{ context: "" }, /who you are/],
    [{ program: "Astrology" }, /program/],
    [{ quote: "Too short." }, /testimonial/],
    [{ quote: "x".repeat(601) }, /testimonial/],
    [{ outcome: "x".repeat(101) }, /outcome/],
    [{ consent: false }, /confirm/],
    [{ consent: "true" }, /confirm/],
  ])("rejects %j", (patch, message) => {
    expect(() => TestimonialContract.parseSubmission({ ...VALID, ...patch })).toThrow(message);
  });

  it("rejects non-object bodies", () => {
    expect(() => TestimonialContract.parseSubmission(null)).toThrow(TestimonialValidationError);
    expect(() => TestimonialContract.parseSubmission("hi")).toThrow(TestimonialValidationError);
  });

  it("recognises statuses", () => {
    expect(TestimonialContract.isStatus("approved")).toBe(true);
    expect(TestimonialContract.isStatus("published")).toBe(false);
    expect(TestimonialContract.isStatus(undefined)).toBe(false);
  });
});

// --------------------------------------------------------------------------

class MemoryStore implements TestimonialStore {
  readonly created: TestimonialSubmission[] = [];
  async approved() {
    return [];
  }
  async list() {
    return [];
  }
  async counts() {
    return { pending: this.created.length, approved: 0, rejected: 0 };
  }
  async create(submission: TestimonialSubmission) {
    this.created.push(submission);
    return { id: `id-${this.created.length}`, status: "pending" as TestimonialStatus };
  }
  async setStatus() {
    return true;
  }
  async remove() {
    return true;
  }
}

function submit(body: unknown, { origin = ORIGIN, ip = "203.0.113.1" } = {}) {
  return submitRoute(
    new NextRequest(`${ORIGIN}/api/testimonials`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, "X-Forwarded-For": ip },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

describe("POST /api/testimonials", () => {
  afterEach(() => vi.restoreAllMocks());

  function withStore(): MemoryStore {
    const store = new MemoryStore();
    vi.spyOn(TestimonialRepository, "fromEnv").mockReturnValue(store as unknown as TestimonialRepository);
    return store;
  }

  it("stores a valid submission as pending", async () => {
    const store = withStore();
    const response = await submit(VALID, { ip: "198.51.100.1" });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "id-1", status: "pending" });
    expect(store.created).toHaveLength(1);
    expect(store.created[0].author).toBe("Ada Lovelace");
  });

  it("rejects cross-origin posts", async () => {
    const store = withStore();
    const response = await submit(VALID, { origin: "https://evil.example", ip: "198.51.100.2" });
    expect(response.status).toBe(403);
    expect(store.created).toHaveLength(0);
  });

  it("rejects invalid bodies with the validation message", async () => {
    withStore();
    const response = await submit({ ...VALID, consent: false }, { ip: "198.51.100.3" });
    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/confirm/);

    expect((await submit("{not json", { ip: "198.51.100.4" })).status).toBe(400);
  });

  it("drops honeypot submissions without storing them", async () => {
    const store = withStore();
    const response = await submit({ ...VALID, website: "https://spam.example" }, { ip: "198.51.100.5" });
    expect(response.status).toBe(400);
    expect(store.created).toHaveLength(0);
  });

  it("answers 503 when no database is configured", async () => {
    vi.spyOn(TestimonialRepository, "fromEnv").mockReturnValue(null);
    expect((await submit(VALID, { ip: "198.51.100.6" })).status).toBe(503);
  });

  it("rate-limits each client IP", async () => {
    withStore();
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await submit(VALID, { ip: "198.51.100.7" })).status);
    expect(statuses).toEqual([201, 201, 201, 429]);
  });
});
