import { describe, expect, it } from "vitest";

import { StructuredData } from "@/core/seo/StructuredData";
import { InlineText } from "@/domains/journal/services/InlineText";

import type { Question } from "../types";
import { QuestionContract, QuestionValidationError } from "./QuestionContract";
import { QuestionTaxonomy } from "./QuestionTaxonomy";

function form(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    level: "1",
    topic: "fixed-income",
    difficulty: "medium",
    title: "Effective Duration & Convexity: Estimated Price Change",
    slug: "",
    stem: "A bond has effective duration 6.2 and convexity 85. Yields rise 75 bp.",
    option0: "$-4.41\\%$",
    option1: "$-4.65\\%$",
    option2: "$-4.89\\%$",
    why1: "Ignores convexity.",
    correct: "0",
    status: "publish",
    publishAt: "2026-10-20T07:00",
    ...overrides,
  };
  for (const [k, v] of Object.entries(base)) fd.set(k, v);
  return fd;
}

describe("QuestionContract", () => {
  it("parses a three-option question, slugs the title and reads the time as GST", () => {
    const q = QuestionContract.parse(form());
    expect(q.slug).toBe("effective-duration-convexity-estimated-price-change");
    expect(q.options).toHaveLength(3);
    expect(q.options[1].why).toBe("Ignores convexity.");
    expect(q.publishAt?.toISOString()).toBe("2026-10-20T03:00:00.000Z");
  });

  it("keeps an optional fourth option and drafts have no publish time", () => {
    const q = QuestionContract.parse(form({ option3: "D", status: "draft" }));
    expect(q.options).toHaveLength(4);
    expect(q.publishAt).toBeNull();
  });

  it("rejects bad input", () => {
    expect(() => QuestionContract.parse(form({ correct: "3" }))).toThrow(QuestionValidationError);
    expect(() => QuestionContract.parse(form({ option2: "" }))).toThrow(/A, B and C/);
    expect(() => QuestionContract.parse(form({ slug: "Bad_Slug" }))).toThrow(/slug/);
    expect(() => QuestionContract.parse(form({ topic: "astrology" }))).toThrow(/topic/);
    expect(() => QuestionContract.parse(form({ imageUrl: "https://x.blob/a.jpg" }))).toThrow(/Describe/);
    expect(() => QuestionContract.parse(form({ publishAt: "" }))).toThrow(/goes live/);
  });

  it("round-trips GST and schedules the next free day at 07:00", () => {
    expect(QuestionContract.toGst(new Date("2026-10-20T03:00:00Z"))).toBe("2026-10-20T07:00");
    // 22:30 GST on the 19th is still the 19th in GST, so the next slot is the 20th.
    expect(QuestionContract.nextSlot(null, new Date("2026-10-19T18:30:00Z"))).toBe("2026-10-20T07:00");
    // 21:00 UTC on the 19th is already the 20th in GST.
    expect(QuestionContract.nextSlot(null, new Date("2026-10-19T21:00:00Z"))).toBe("2026-10-21T07:00");
    expect(QuestionContract.nextSlot(new Date("2026-10-25T03:00:00Z"), new Date("2026-10-19T00:00:00Z"))).toBe("2026-10-26T07:00");
  });
});

describe("display maths", () => {
  it("splits $$…$$ (even across lines and mid-paragraph) into its own block", () => {
    const p = InlineText.paragraphs("Duration effect:\n$$\n-6.2 \\times 0.0075\n$$\nso the loss is $4.65\\%$.");
    expect(p).toEqual([
      { kind: "p", lines: ["Duration effect:"] },
      { kind: "math", tex: "-6.2 \\times 0.0075" },
      { kind: "p", lines: ["so the loss is $4.65\\%$."] },
    ]);
  });

  it("leaves prices and escaped dollars alone", () => {
    expect(InlineText.paragraphs("Paid \\$$5 and $10.")).toEqual([{ kind: "p", lines: ["Paid \\$$5 and $10."] }]);
  });
});

describe("StructuredData.question", () => {
  it("marks the correct option as the accepted answer", () => {
    const q = {
      ...QuestionContract.parse(form()),
      id: "x",
      code: "FIP-CFA-L1-FI-001",
      createdAt: new Date(),
      updatedAt: new Date("2026-10-20T03:00:00Z"),
    } satisfies Question;
    const graph = StructuredData.question(q)["@graph"] as Record<string, unknown>[];
    const part = (graph[0].hasPart as Record<string, unknown>[])[0];
    expect((part.acceptedAnswer as { position: number }).position).toBe(0);
    expect(part.suggestedAnswer).toHaveLength(2);
    expect(graph[1]["@type"]).toBe("BreadcrumbList");
  });
});

describe("exam pace", () => {
  it("is 90s at Level I, 180s at Level II and none at Level III", () => {
    expect([1, 2, 3].map(QuestionTaxonomy.examPaceSeconds)).toEqual([90, 180, null]);
  });
});
