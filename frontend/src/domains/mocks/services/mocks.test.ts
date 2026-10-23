import { describe, expect, it } from "vitest";

import type { MockQuestion, MockResponse } from "../types";
import { MockContract } from "./MockContract";
import { MockGrader } from "./MockGrader";

const HEADER = "Number,Topic,Vignette (Optional),Question,Option_A,Option_B,Option_C,Correct_Option,Explanation (Optional)";

describe("MockContract.parseSheet", () => {
  it("turns a valid CSV into exact questions: quoted commas, line breaks, KaTeX and a UTF-8 BOM", () => {
    const csv = [
      `﻿${HEADER}`,
      `2,Fixed Income,,"Duration 6.2, convexity 85: price change for +75bp?",$-4.41\\%$,$-4.65\\%$,$-4.89\\%$,a,"Convexity adds back $\\tfrac12 C (\\Delta y)^2$."`,
      `1,FSA,"Case: Alder Corp.
Revenue rose 12%, ""adjusted"" EBIT 40.",Calculate FCFF.,$142.5m,$158.0m,$164.2m,B,`,
    ].join("\r\n");
    const sheet = MockContract.parseSheet(csv);
    expect(sheet).toEqual({
      ok: true,
      questions: [
        {
          number: 1,
          topic: "FSA",
          vignette: 'Case: Alder Corp.\nRevenue rose 12%, "adjusted" EBIT 40.',
          question: "Calculate FCFF.",
          options: ["$142.5m", "$158.0m", "$164.2m"],
          correct: "B",
          explanation: "",
        },
        {
          number: 2,
          topic: "Fixed Income",
          vignette: "",
          question: "Duration 6.2, convexity 85: price change for +75bp?",
          options: ["$-4.41\\%$", "$-4.65\\%$", "$-4.89\\%$"],
          correct: "A",
          explanation: "Convexity adds back $\\tfrac12 C (\\Delta y)^2$.",
        },
      ],
    });
  });

  it("reads rows pasted from Excel (tab-separated) and skips blank rows", () => {
    const tsv = [HEADER.replaceAll(",", "\t"), "1\tEthics\t\tWhich standard?\tI(A)\tI(B)\tI(C)\tC\t", "\t\t\t\t\t\t\t\t", ""].join("\n");
    const sheet = MockContract.parseSheet(tsv);
    expect(sheet.ok && sheet.questions.map((q) => [q.number, q.correct])).toEqual([[1, "C"]]);
  });

  it("reports every invalid row with its line and reason, and saves nothing", () => {
    const csv = [
      HEADER,
      "1,Ethics,,Q one,a,b,c,D,",
      "x,,,Q two,a,,c,A,",
      "3,Quant,,Q three,a,b,c,C,",
      "3,Quant,,Q four,a,b,c,1,",
    ].join("\n");
    expect(MockContract.parseSheet(csv)).toEqual({
      ok: false,
      errors: [
        'Row 2: Correct_Option must be A, B or C (got "D").',
        'Row 3: Number "x" is not 1 to 500; Topic is empty; Option_B is empty.',
        'Row 5: Number 3 is used twice; Correct_Option must be A, B or C (got "1").',
      ],
    });
  });

  it("names missing required columns", () => {
    expect(MockContract.parseSheet("Number,Topic,Question\n1,FSA,Q")).toEqual({ ok: false, errors: ["Missing columns: a, b, c, correct."] });
  });
});

describe("MockContract.parsePool", () => {
  const form = (entries: [string, string][]) => {
    const f = new FormData();
    for (const [k, v] of entries) f.append(k, v);
    return f;
  };

  it("takes the ticked topics and mocks, dropping blanks, repeats and bad ids", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(MockContract.parsePool(form([["topic", "FSA"], ["topic", " FSA "], ["topic", ""], ["from", id], ["from", "x"], ["count", "30"]]))).toEqual({
      ok: true,
      value: { topics: ["FSA"], from: [id], count: 30 },
    });
  });

  it("needs a topic and a whole count of 1 to 500", () => {
    expect(MockContract.parsePool(form([["count", "30"]]))).toEqual({ ok: false, error: "Tick at least one topic." });
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", "2.5"]])).ok).toBe(false);
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", "501"]])).ok).toBe(false);
  });
});

describe("MockContract.parseAccess", () => {
  const form = (entries: [string, string][]) => {
    const f = new FormData();
    for (const [k, v] of entries) f.append(k, v);
    return f;
  };
  const id = "11111111-1111-4111-8111-111111111111";

  it("keeps only the list the chosen audience uses", () => {
    const ticks: [string, string][] = [["course", "CFA Level I"], ["course", "CFA Level I"], ["client", id], ["client", "x"]];
    expect(MockContract.parseAccess(form([["audience", "course"], ...ticks]))).toEqual({ ok: true, value: { audience: "course", courses: ["CFA Level I"], clients: [] } });
    expect(MockContract.parseAccess(form([["audience", "clients"], ...ticks]))).toEqual({ ok: true, value: { audience: "clients", courses: [], clients: [id] } });
    expect(MockContract.parseAccess(form([["audience", "all"], ...ticks]))).toEqual({ ok: true, value: { audience: "all", courses: [], clients: [] } });
  });

  it("refuses an unknown audience or an empty list", () => {
    expect(MockContract.parseAccess(form([["audience", "everyone"]])).ok).toBe(false);
    expect(MockContract.parseAccess(form([["audience", "course"]]))).toEqual({ ok: false, error: "Tick at least one course." });
    expect(MockContract.parseAccess(form([["audience", "clients"], ["client", "x"]]))).toEqual({ ok: false, error: "Tick at least one client." });
  });
});

describe("MockContract.parseResponses", () => {
  it("keeps well-formed answers and drops anything else", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(
      MockContract.parseResponses([
        { questionId: id, selected: "B", flagged: true, notes: "WACC first" },
        { questionId: id, selected: "A" },
        { questionId: "not-a-uuid", selected: "A" },
        { questionId: "22222222-2222-4222-8222-222222222222", selected: "D", flagged: "yes", notes: 7 },
        null,
      ]),
    ).toEqual([
      { questionId: id, selected: "B", flagged: true, notes: "WACC first" },
      { questionId: "22222222-2222-4222-8222-222222222222", selected: null, flagged: false, notes: "" },
    ]);
  });
});

const q = (id: string, topic: string, correct: "A" | "B" | "C"): MockQuestion => ({
  id,
  number: Number(id),
  topic,
  vignette: "",
  question: `Q${id}`,
  options: ["a", "b", "c"],
  correct,
  explanation: `Because ${correct}`,
});
const QUESTIONS = [q("1", "FSA", "A"), q("2", "FSA", "B"), q("3", "Quant", "C"), q("4", "FSA", "C"), q("5", "Quant", "A")];
const r = (questionId: string, selected: MockResponse["selected"], flagged = false, notes = ""): MockResponse => ({ questionId, selected, flagged, notes });

describe("MockGrader", () => {
  it("scores one mark per correct answer, with the topic breakdown", () => {
    const grade = MockGrader.grade(QUESTIONS, [r("1", "A"), r("2", "C", true, "check sign"), r("3", "C"), r("4", null, true)]);
    expect(grade).toEqual({
      score: 2,
      total: 5,
      topics: [
        { topic: "FSA", correct: 1, total: 3 },
        { topic: "Quant", correct: 1, total: 2 },
      ],
    });
  });

  it("strips the answer and explanation from an open attempt's questions", () => {
    const active = QUESTIONS.map(MockGrader.active);
    const json = JSON.stringify(active);
    expect(json).not.toMatch(/correct|explanation|Because/);
    expect(Object.keys(active[0]).sort()).toEqual(["id", "number", "options", "question", "topic", "vignette"]);
  });

  it("after the clock, keeps the autosaved answer but takes the new flag and notes", () => {
    const stored = [r("1", "A"), r("2", "B")];
    const sent = [r("1", "C", true, "late note"), r("3", "C")];
    expect(MockGrader.merge(stored, sent, false)).toEqual([r("1", "A", true, "late note"), r("2", "B"), r("3", null)]);
    expect(MockGrader.merge(stored, sent, true)).toEqual([r("1", "C", true, "late note"), r("2", "B"), r("3", "C")]);
  });

  it("formats the clock and the grace window", () => {
    expect(MockGrader.clock(6862)).toBe("1:54:22");
    expect(MockGrader.clock(425)).toBe("7:05");
    expect(MockGrader.clock(-3)).toBe("0:00");
    const end = new Date("2026-10-23T10:00:00Z");
    expect(MockGrader.open(end, new Date("2026-10-23T10:00:29Z"))).toBe(true);
    expect(MockGrader.open(end, new Date("2026-10-23T10:00:31Z"))).toBe(false);
  });
});
