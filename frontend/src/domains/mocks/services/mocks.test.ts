import { describe, expect, it } from "vitest";

import type { MockQuestion, MockResponse } from "../types";
import { MockContract } from "./MockContract";
import { MockGrader } from "./MockGrader";
import { MockProgress } from "./MockProgress";

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
          chapter: "",
          usage: "mock",
          vignette: 'Case: Alder Corp.\nRevenue rose 12%, "adjusted" EBIT 40.',
          question: "Calculate FCFF.",
          options: ["$142.5m", "$158.0m", "$164.2m"],
          correct: "B",
          explanation: "",
        },
        {
          number: 2,
          topic: "Fixed Income",
          chapter: "",
          usage: "mock",
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

  it("needs no Number column, reads Chapter and Usage, and a blank Usage takes the upload's default", () => {
    const sheet = MockContract.parseSheet(
      ["Topic,Chapter,Usage,Question,Option_A,Option_B,Option_C,Correct_Option", "FSA,Inventories,Practice,Q one,a,b,c,A", "FSA,,,Q two,a,b,c,B"].join("\n"),
      "both",
    );
    expect(sheet.ok && sheet.questions.map((q) => [q.number, q.chapter, q.usage])).toEqual([
      [1, "Inventories", "practice"],
      [2, "", "both"],
    ]);
  });

  it("rejects an unknown Usage", () => {
    const sheet = MockContract.parseSheet(["Topic,Usage,Question,Option_A,Option_B,Option_C,Correct_Option", "FSA,exam,Q,a,b,c,A"].join("\n"));
    expect(sheet).toEqual({ ok: false, errors: ['Row 2: Usage must be mock, practice or both (got "exam").'] });
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

  it("takes a number per topic (blank or 0 skipped, one per topic ignoring case), ticked ids and a chapter, dropping bad ids", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const entries: [string, string][] = [
      ["topic", "Fixed Income"],
      ["count", "10"],
      ["topic", "FSA"],
      ["count", "20"],
      ["topic", "fsa "],
      ["count", "5"],
      ["topic", "Ethics"],
      ["count", ""],
      ["topic", "Quant"],
      ["count", "0"],
      ["q", id],
      ["q", id],
      ["q", "x"],
      ["chapter", " Inventories "],
    ];
    expect(MockContract.parsePool(form(entries))).toEqual({
      ok: true,
      value: { quotas: [{ topic: "Fixed Income", count: 10 }, { topic: "FSA", count: 20 }], ids: [id], chapter: "Inventories" },
    });
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", ""], ["q", id]]))).toEqual({ ok: true, value: { quotas: [], ids: [id], chapter: "" } });
  });

  it("needs a number or a tick, whole numbers, and at most 500", () => {
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", "0"]]))).toEqual({ ok: false, error: "Give a topic a number of questions, or tick some." });
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", "2.5"]])).ok).toBe(false);
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", "-1"]])).ok).toBe(false);
    expect(MockContract.parsePool(form([["topic", "FSA"], ["count", "300"], ["topic", "FI"], ["count", "201"]])).ok).toBe(false);
  });
});

describe("MockContract.parseGrant", () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.append(k, v);
    return f;
  };
  const id = "11111111-1111-4111-8111-111111111111";

  it("takes a product or one mock, with days in Dubai and an open or inclusive end", () => {
    expect(MockContract.parseGrant(form({ target: "practice", startsAt: "2026-11-01", endsAt: "" }))).toEqual({
      ok: true,
      value: { product: "practice", mockId: null, startsAt: new Date("2026-10-31T20:00:00Z"), endsAt: null },
    });
    expect(MockContract.parseGrant(form({ target: id, startsAt: "2026-11-01", endsAt: "2026-11-30" }))).toEqual({
      ok: true,
      value: { product: null, mockId: id, startsAt: new Date("2026-10-31T20:00:00Z"), endsAt: new Date("2026-11-30T19:59:59Z") },
    });
  });

  it("refuses an unknown target, a missing start and an end before the start", () => {
    expect(MockContract.parseGrant(form({ target: "everything", startsAt: "2026-11-01" })).ok).toBe(false);
    expect(MockContract.parseGrant(form({ target: "mocks", startsAt: "" })).ok).toBe(false);
    expect(MockContract.parseGrant(form({ target: "mocks", startsAt: "2026-11-02", endsAt: "2026-11-01" }))).toEqual({ ok: false, error: "The end date is before the start date." });
  });
});

describe("MockContract.usages", () => {
  it("keeps mock-only questions out of practice sets and practice-only ones out of mocks", () => {
    expect(MockContract.usages("chapter")).toEqual(["practice", "both"]);
    expect(MockContract.usages("topic")).toEqual(["practice", "both"]);
    expect(MockContract.usages("full")).toEqual(["mock", "both"]);
    expect(MockContract.usages("book")).toEqual(["mock", "both"]);
  });
});

describe("MockContract.minutes", () => {
  it("is the CFA pace, a full mock's per session", () => {
    expect(MockContract.minutes(90, "book")).toBe(135);
    expect(MockContract.minutes(80, "topic")).toBe(120);
    expect(MockContract.minutes(180, "full")).toBe(135);
    expect(MockContract.minutes(7, "random")).toBe(11);
    expect(MockContract.minutes(0, "book")).toBe(1);
  });
});

describe("MockContract.parseQuestion", () => {
  const form = (entries: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(entries)) f.append(k, v);
    return f;
  };
  const good = { number: "4", topic: " Fixed Income ", vignette: "Chart: Spot\n| Year | Rate |\n| 1 | 3.2 |\n| 2 | 3.6 |", question: "Q?", a: "x", b: "y", c: "z", correct: "b", explanation: "" };

  it("checks one question as a sheet row is checked", () => {
    expect(MockContract.parseQuestion(form(good))).toEqual({
      ok: true,
      value: { number: 4, topic: "Fixed Income", chapter: "", usage: "mock", vignette: good.vignette, question: "Q?", options: ["x", "y", "z"], correct: "B", explanation: "" },
    });
    expect(MockContract.parseQuestion(form({ ...good, c: "", correct: "D", vignette: "Chart: Spot\n| Year | Rate |\n| 1 | n/a |" }))).toEqual({
      ok: false,
      errors: ['Correct_Option must be A, B or C (got "D")', "Option_C is empty", expect.stringMatching(/^Vignette chart "Spot"/)],
    });
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
    expect(MockContract.parseAccess(form([["audience", "course"], ...ticks]))).toEqual({ ok: true, value: { audience: "course", courses: ["CFA Level I"], clients: [], endsAt: null } });
    expect(MockContract.parseAccess(form([["audience", "clients"], ...ticks]))).toEqual({ ok: true, value: { audience: "clients", courses: [], clients: [id], endsAt: null } });
    expect(MockContract.parseAccess(form([["audience", "all"], ...ticks]))).toEqual({ ok: true, value: { audience: "all", courses: [], clients: [], endsAt: null } });
  });

  it("refuses an unknown audience or an empty list", () => {
    expect(MockContract.parseAccess(form([["audience", "everyone"]])).ok).toBe(false);
    expect(MockContract.parseAccess(form([["audience", "course"]]))).toEqual({ ok: false, error: "Tick at least one course." });
    // Grant-only with nobody ticked is allowed: a product grant or a purchase opens it.
    expect(MockContract.parseAccess(form([["audience", "clients"], ["client", "x"]]))).toEqual({ ok: true, value: { audience: "clients", courses: [], clients: [], endsAt: null } });
    expect(MockContract.parseAccess(form([["audience", "all"], ["endsAt", "soon"]])).ok).toBe(false);
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

describe("MockGrader.arrange", () => {
  const q = (n: number, vignette = "") => ({ id: `q${n}`, number: n, vignette });
  const qs = [q(1), q(2, "case A"), q(3, "case A"), q(4), q(5), q(6, "case B"), q(7, "case B"), q(8)];
  const ids = (list: { id: string }[]) => list.map((x) => x.id);

  it("keeps the mock's order on a first attempt", () => {
    expect(ids(MockGrader.arrange(qs, null))).toEqual(ids(qs));
  });

  it("gives each retake its own order, the same every time it loads, renumbered 1…n", () => {
    const a = MockGrader.arrange(qs, "attempt-1");
    expect(MockGrader.arrange(qs, "attempt-1")).toEqual(a);
    expect(ids(MockGrader.arrange(qs, "attempt-2"))).not.toEqual(ids(a));
    expect([...ids(a)].sort()).toEqual([...ids(qs)].sort());
    expect(a.map((x) => x.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("keeps questions on one vignette together and in their order", () => {
    for (const seed of ["s1", "s2", "s3", "s4"]) {
      const order = ids(MockGrader.arrange(qs, seed));
      expect(order.indexOf("q3")).toBe(order.indexOf("q2") + 1);
      expect(order.indexOf("q7")).toBe(order.indexOf("q6") + 1);
    }
  });
});

describe("MockProgress.build", () => {
  const row = (attemptId: string, at: string, topic: string, correct: number, total: number) => ({ attemptId, title: `Mock ${attemptId}`, at, topic, correct, total });

  it("makes each attempt a mark and each topic a trend, matching topics across uploads, weakest topic first", () => {
    const p = MockProgress.build([
      row("a1", "2026-10-01T10:00:00Z", "FSA", 6, 10),
      row("a1", "2026-10-01T10:00:00Z", "Ethics", 9, 10),
      row("a2", "2026-10-08T10:00:00Z", "fsa ", 8, 10),
      row("a2", "2026-10-08T10:00:00Z", "Ethics", 10, 10),
    ]);
    expect(p.mocks.map((m) => [m.id, m.pct, m.link])).toEqual([
      ["a1", 75, "/student/mocks/a1"],
      ["a2", 90, "/student/mocks/a2"],
    ]);
    expect(p).toMatchObject({ latest: 90, best: 90, average: 83, change: 15, overall: { count: 2 } });
    expect(p.topics.map((t) => [t.name, t.pct, t.scores.map((s) => s.pct)])).toEqual([
      ["FSA", 70, [60, 80]],
      ["Ethics", 95, [90, 100]],
    ]);
  });

  it("is empty with no attempts", () => {
    expect(MockProgress.build([])).toMatchObject({ mocks: [], latest: null, change: null, topics: [], overall: { last: null, count: 0 } });
  });
});

describe("MockGrader.session", () => {
  const q = (id: string, vignette = "") => ({ id, vignette });
  it("splits a full mock in half, rounding up, and never cuts a vignette set", () => {
    const plain = ["1", "2", "3", "4", "5"].map((id) => q(id));
    expect(MockGrader.session(plain, 2, 1).map((x) => x.id)).toEqual(["1", "2", "3"]);
    expect(MockGrader.session(plain, 2, 2).map((x) => x.id)).toEqual(["4", "5"]);
    const sets = [q("1"), q("2", "case"), q("3", "case"), q("4", "case"), q("5")];
    expect(MockGrader.session(sets, 2, 1).map((x) => x.id)).toEqual(["1", "2", "3", "4"]);
    expect(MockGrader.session(sets, 1, 1)).toHaveLength(5);
  });
});
