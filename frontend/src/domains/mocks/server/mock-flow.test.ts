import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextRequest } from "next/server";

import { POST } from "@/app/api/student/mocks/[attemptId]/route";
import MockAttemptPage from "@/app/student/mocks/[attemptId]/page";
import type { Sql } from "@/core/db/Database";

import { AttemptResults } from "../components/AttemptResults";
import { MockBreak } from "../components/MockBreak";
import { MockPlayer } from "../components/MockPlayer";
import { MockResults, type ReviewQuestion } from "../components/MockResults";
import type { MockAttempt, MockGrade, MockQuestion, MockResponse } from "../types";
import { MockRepository } from "./MockRepository";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), refresh: vi.fn() }));
vi.mock("@/domains/students/server/StudentAuth", () => ({
  StudentAuth: { current: vi.fn(async () => ({ id: CLIENT, name: "Ali Khan", email: "ali@example.com", courses: [] })) },
}));

const CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ATTEMPT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MOCK = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
/** Any player call, through its Route Handler as the browser sends it. */
async function call(body: object) {
  const request = new NextRequest(`https://financeinpractice.me/api/student/mocks/${ATTEMPT}`, { method: "POST", headers: { origin: "https://financeinpractice.me", "content-type": "application/json" }, body: JSON.stringify(body) });
  const res = await POST(request, { params: Promise.resolve({ attemptId: ATTEMPT }) });
  return res.status === 200 ? await res.json() : { status: res.status };
}
/** The player's submit, through its Route Handler as the browser sends it. */
async function submitMock(attemptId: string, responses: unknown, { auto = false, origin = "https://financeinpractice.me" } = {}) {
  const request = new NextRequest(`https://financeinpractice.me/api/student/mocks/${attemptId}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ op: "submit", responses, auto }) });
  const res = await POST(request, { params: Promise.resolve({ attemptId }) });
  return res.status === 200 ? await res.json() : { status: res.status };
}
const qid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const QUESTIONS: MockQuestion[] = [
  { id: qid(1), number: 1, topic: "FSA", vignette: "Alder Corp: EBIT $40$m.", question: "FCFF?", options: ["$142.5m", "$158.0m", "$164.2m"], correct: "B", explanation: "SECRET-1: add back D&A.", why: ["", "", ""] },
  { id: qid(2), number: 2, topic: "FSA", vignette: "", question: "Quick ratio?", options: ["0.8", "1.1", "1.4"], correct: "A", explanation: "SECRET-2", why: ["", "", ""] },
  { id: qid(3), number: 3, topic: "Quant", vignette: "", question: "$\\sigma$ of the sample?", options: ["2", "4", "16"], correct: "A", explanation: "SECRET-3", why: ["", "", ""] },
];

/** The repository in memory: what the page and the actions read and write. */
class FakeRepo {
  attemptRow: MockAttempt;
  saved: MockResponse[] = [];
  completed: { grade: MockGrade; responses: MockResponse[] } | null = null;
  mockType = "book";

  constructor(endsAt: Date) {
    this.attemptRow = { id: ATTEMPT, clientId: CLIENT, mockId: MOCK, startedAt: new Date(Date.now() - 600_000), endsAt, submittedAt: null, score: null, total: 3, status: "in_progress", session: 1, breakUntil: null, pausedAt: null, questionIds: null, screen: null };
  }
  async attempt(id: string, clientId: string) {
    return id === ATTEMPT && clientId === CLIENT ? { ...this.attemptRow } : null;
  }
  async published() {
    return [await this.byId()];
  }
  async openAttempt() {
    return null;
  }
  async byId() {
    return { id: MOCK, title: "Book 3 · FSA", mockType: this.mockType, source: "Book 3", durationMinutes: 135, level: 1, published: true, questionCount: 3, attempted: true, createdAt: new Date() };
  }
  // Deliberately returns the full rows, answers included: the page must still never pass them on.
  async activeQuestions() {
    return QUESTIONS;
  }
  async questions() {
    return QUESTIONS;
  }
  async responses() {
    return this.saved;
  }
  async seed() {
    return null;
  }
  // Like the SQL: session 1's answers saved, the break from when its clock ended (or now), then session 2's clock.
  async endSession(_id: string, _client: string, responses: MockResponse[]) {
    if (this.attemptRow.status !== "in_progress" || this.attemptRow.session !== 1) return false;
    const ids = new Set(responses.map((r) => r.questionId));
    this.saved = [...this.saved.filter((r) => !ids.has(r.questionId)), ...responses];
    const from = Math.min(Date.now(), this.attemptRow.endsAt.getTime());
    this.attemptRow = { ...this.attemptRow, session: 2, breakUntil: new Date(from + 30 * 60_000), endsAt: new Date(from + (30 + 135) * 60_000) };
    return true;
  }
  autosaves = 0;
  async autosave(_id: string, _client: string, responses: MockResponse[]) {
    this.autosaves += 1;
    const ids = new Set(responses.map((r) => r.questionId));
    this.saved = [...this.saved.filter((r) => !ids.has(r.questionId)), ...responses];
    return true;
  }
  async classScores() {
    return [] as number[];
  }
  async claimScreen(_id: string, _client: string, screen: string) {
    if (this.attemptRow.status === "in_progress") this.attemptRow = { ...this.attemptRow, screen };
  }
  async startSession() {
    this.attemptRow = { ...this.attemptRow, breakUntil: new Date(), endsAt: new Date(Date.now() + 135 * 60_000) };
    return true;
  }
  async complete(_id: string, _client: string, grade: MockGrade, responses: MockResponse[]) {
    if (this.attemptRow.status !== "in_progress") return false;
    this.completed = { grade, responses };
    this.saved = responses;
    // Like the SQL: closed no later than the clock's end.
    const submittedAt = new Date(Math.min(Date.now(), this.attemptRow.endsAt.getTime()));
    this.attemptRow = { ...this.attemptRow, status: "completed", score: grade.score, submittedAt };
    return true;
  }
}

function find(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | null {
  if (Array.isArray(node)) return node.map((n) => find(n, type)).find(Boolean) ?? null;
  if (!isValidElement<{ children?: ReactNode }>(node)) return null;
  if (node.type === type) return node as ReactElement<Record<string, unknown>>;
  return find(node.props.children, type);
}

/** The results the page renders: AttemptResults loads them, so run it to reach MockResults. */
async function resultsOf(page: ReactNode) {
  const el = find(page, AttemptResults);
  return el ? find(await AttemptResults(el.props as Parameters<typeof AttemptResults>[0]), MockResults) : null;
}

const render = async () => MockAttemptPage({ params: Promise.resolve({ attemptId: ATTEMPT }), searchParams: Promise.resolve({}) } as never);

let repo: FakeRepo;
beforeEach(() => {
  repo = new FakeRepo(new Date(Date.now() + 60 * 60_000));
  vi.spyOn(MockRepository, "fromEnv").mockReturnValue(repo as unknown as MockRepository);
});

describe("a paused attempt", () => {
  it("keeps the student in the player, clock stopped at the time left at the pause, and isn't closed though its end time has passed", async () => {
    const pausedAt = new Date(Date.now() - 2 * 60 * 60_000);
    repo.attemptRow = { ...repo.attemptRow, pausedAt, endsAt: new Date(pausedAt.getTime() + 25 * 60_000) };
    const player = find(await render(), MockPlayer);
    expect(player?.props.paused).toBe(true);
    expect(player?.props.remainingMs).toBe(25 * 60_000);
    expect(JSON.stringify(player?.props)).not.toMatch(/"correct"|"explanation"|SECRET/);
    expect(repo.completed).toBeNull();
  });
});

describe("one screen at a time", () => {
  const PHONE = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const LAPTOP = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const answer = [{ questionId: qid(1), selected: "A", flagged: false, notes: "", seconds: 30, confidence: null }];

  it("the screen opened last saves; the other one is refused for save, pause, resume and submit, and writes nothing", async () => {
    expect(await call({ op: "claim", screen: PHONE })).toEqual({ ok: true });
    expect(await call({ op: "save", screen: PHONE, responses: answer })).toEqual({ open: true });
    expect(await call({ op: "claim", screen: LAPTOP })).toEqual({ ok: true });
    const before = repo.autosaves;
    expect(await call({ op: "save", screen: PHONE, responses: [] })).toEqual({ open: true, taken: true });
    expect(await call({ op: "pause", screen: PHONE, responses: [] })).toEqual({ ok: false, taken: true });
    expect(await call({ op: "resume", screen: PHONE })).toEqual({ remainingMs: null, taken: true });
    expect(await call({ op: "submit", screen: PHONE, responses: [] })).toEqual({ ok: true, stale: true, taken: true });
    expect(repo.autosaves).toBe(before);
    expect(repo.attemptRow.pausedAt).toBeNull();
    expect(repo.completed).toBeNull();
    expect(await call({ op: "save", screen: LAPTOP, responses: answer })).toEqual({ open: true });
  });

  it("a page from before screens (no screen sent) saves until a screen claims it, then gets an error (its 'Not saved'), and its submit reloads it", async () => {
    expect(await call({ op: "save", responses: answer })).toEqual({ open: true });
    await call({ op: "claim", screen: LAPTOP });
    const before = repo.autosaves;
    expect(await call({ op: "save", responses: answer })).toEqual({ status: 409 });
    expect(await call({ op: "pause", responses: answer })).toEqual({ status: 409 });
    expect(await call({ op: "submit", responses: answer })).toEqual({ ok: true, stale: true, taken: true });
    expect(repo.autosaves).toBe(before);
    expect(repo.completed).toBeNull();
  });

  it("a claim needs a screen id", async () => {
    expect(await call({ op: "claim" })).toEqual({ status: 400 });
    expect(repo.attemptRow.screen).toBeNull();
  });
});

describe("the player's submit route", () => {
  it("refuses another site's request", async () => {
    expect(await submitMock(ATTEMPT, [], { origin: "https://evil.example" })).toEqual({ status: 403 });
    expect(repo.completed).toBeNull();
  });

  it("never closes a paused attempt (a save or the clock in another tab)", async () => {
    repo.attemptRow = { ...repo.attemptRow, pausedAt: new Date() };
    expect(await submitMock(ATTEMPT, [], { auto: true })).toEqual({ ok: true, stale: true });
    expect(await submitMock(ATTEMPT, [])).toEqual({ ok: true, stale: true });
    expect(repo.completed).toBeNull();
  });

  it("an auto submit from a tab whose clock is behind the server's leaves the attempt open; the student's own submit closes it", async () => {
    expect(await submitMock(ATTEMPT, [], { auto: true })).toEqual({ ok: true, stale: true });
    expect(repo.completed).toBeNull();
    expect(await submitMock(ATTEMPT, [])).toEqual({ ok: true });
    expect(repo.completed).not.toBeNull();
  });
});

describe("an open attempt's page (anti-cheat)", () => {
  it("hands the player no answer key and no explanation, and the server's remaining time", async () => {
    const player = find(await render(), MockPlayer);
    expect(player).not.toBeNull();
    const props = player!.props;
    const json = JSON.stringify(props);
    expect(json).not.toMatch(/"correct"|"explanation"|SECRET/);
    expect(props.studentName).toBe("Ali Khan");
    expect(props.remainingMs).toBeGreaterThan(59 * 60_000);
    expect((props.questions as { id: string }[]).map((q) => q.id)).toEqual(QUESTIONS.map((q) => q.id));
    // KaTeX ran on the server: the vignette's $40$ arrives as rendered maths.
    const [first] = props.questions as { vignette: ReactNode; options: ReactNode[] }[];
    expect(renderToStaticMarkup(first.vignette)).toContain('class="katex"');
    expect(renderToStaticMarkup(first.options[0])).toContain("142.5m");
  });

  it("only ever asks the database for answer-free columns", async () => {
    const queries: string[] = [];
    const sql = ((strings: TemplateStringsArray) => {
      queries.push(strings.join("?"));
      return Promise.resolve([]);
    }) as unknown as Sql;
    await new MockRepository(sql).activeQuestions(MOCK);
    expect(queries).toHaveLength(1);
    expect(queries[0]).not.toMatch(/\bcorrect\b|explanation|\*/);
  });
});

describe("submitting (grading and notes)", () => {
  const sent = [
    { questionId: qid(1), selected: "B", flagged: true, notes: "FCFF = EBIT(1-t) + D&A - capex - ΔWC", seconds: 140, confidence: "guess" },
    { questionId: qid(2), selected: "C", flagged: false, notes: "", seconds: 0, confidence: null },
    { questionId: qid(3), selected: null, flagged: true, notes: "revise std dev", seconds: 12, confidence: null },
  ];

  it("grades exactly, saves the notes, and the results page returns them with the answers", async () => {
    expect(await submitMock(ATTEMPT, sent)).toEqual({ ok: true });
    expect(repo.completed?.grade).toEqual({
      score: 1,
      total: 3,
      topics: [
        { topic: "FSA", correct: 1, total: 2 },
        { topic: "Quant", correct: 0, total: 1 },
      ],
    });
    expect(repo.completed?.responses).toEqual(sent);

    const results = await resultsOf(await render());
    expect(results).not.toBeNull();
    expect(find(await render(), MockPlayer)).toBeNull();
    const review = results!.props.questions as ReviewQuestion[];
    expect(review.map((q) => [q.correct, q.selected, q.flagged, q.notes])).toEqual([
      ["B", "B", true, "FCFF = EBIT(1-t) + D&A - capex - ΔWC"],
      ["A", "C", false, ""],
      ["A", null, true, "revise std dev"],
    ]);
    expect(review.every((q) => q.explanation !== null)).toBe(true);
    expect((results!.props.grade as MockGrade).score).toBe(1);
  });

  it("a second submit changes nothing", async () => {
    await submitMock(ATTEMPT, sent);
    const first = repo.completed;
    await submitMock(ATTEMPT, [{ questionId: qid(2), selected: "A", flagged: false, notes: "", seconds: 0, confidence: null }]);
    expect(repo.completed).toBe(first);
  });

  it("after the clock, a late answer doesn't count but its notes do", async () => {
    repo = new FakeRepo(new Date(Date.now() - 5 * 60_000));
    repo.saved = [{ questionId: qid(2), selected: "C", flagged: false, notes: "", seconds: 0, confidence: null }];
    vi.spyOn(MockRepository, "fromEnv").mockReturnValue(repo as unknown as MockRepository);
    await submitMock(ATTEMPT, [{ questionId: qid(2), selected: "A", flagged: true, notes: "should have been A" }]);
    expect(repo.completed?.grade.score).toBe(0);
    expect(repo.completed?.responses).toEqual([{ questionId: qid(2), selected: "C", flagged: true, notes: "should have been A", seconds: 0, confidence: null }]);
  });

  it("coming back to an attempt whose clock ran out closes it from the autosaved answers", async () => {
    repo = new FakeRepo(new Date(Date.now() - 5 * 60_000));
    repo.saved = [{ questionId: qid(1), selected: "B", flagged: false, notes: "kept", seconds: 0, confidence: null }];
    vi.spyOn(MockRepository, "fromEnv").mockReturnValue(repo as unknown as MockRepository);
    const results = await resultsOf(await render());
    expect(results).not.toBeNull();
    expect(repo.completed?.grade.score).toBe(1);
    // Started 10 minutes ago, clock ended 5 minutes ago: 5 minutes taken, not the time until the revisit.
    expect(results!.props.seconds).toBeCloseTo(300, 0);
  });
});

describe("a full mock in two sessions", () => {
  beforeEach(() => {
    repo.mockType = "full";
  });

  it("shows session 1's half, locks it at the break, then shows only session 2 and grades both", async () => {
    const first = find(await render(), MockPlayer)!.props;
    expect((first.questions as { id: string; number: number }[]).map((q) => [q.id, q.number])).toEqual([
      [qid(1), 1],
      [qid(2), 2],
    ]);
    expect(first.session).toEqual({ index: 1, of: 2 });

    // Ending session 1 keeps only its own answers: q3 belongs to session 2.
    await submitMock(ATTEMPT, [
      { questionId: qid(1), selected: "B", flagged: false, notes: "", seconds: 0, confidence: null },
      { questionId: qid(2), selected: "A", flagged: false, notes: "", seconds: 0, confidence: null },
      { questionId: qid(3), selected: "A", flagged: false, notes: "", seconds: 0, confidence: null },
    ]);
    expect(repo.completed).toBeNull();
    expect(repo.saved.map((r) => r.questionId)).toEqual([qid(1), qid(2)]);
    expect(find(await render(), MockBreak)).not.toBeNull();

    await repo.startSession();
    const second = find(await render(), MockPlayer)!.props;
    expect((second.questions as { id: string; number: number }[]).map((q) => [q.id, q.number])).toEqual([[qid(3), 1]]);
    expect(second.session).toEqual({ index: 2, of: 2 });

    // Trying to change a session-1 answer now does nothing.
    await submitMock(ATTEMPT, [
      { questionId: qid(1), selected: "C", flagged: false, notes: "", seconds: 0, confidence: null },
      { questionId: qid(3), selected: "A", flagged: false, notes: "", seconds: 0, confidence: null },
    ]);
    expect(repo.completed?.grade.score).toBe(3);
    expect(repo.completed?.responses.find((r) => r.questionId === qid(1))?.selected).toBe("B");
  });

  it("away past session 1's clock: it closes from the autosave and the break counts from when the clock ended", async () => {
    repo = new FakeRepo(new Date(Date.now() - 5 * 60_000));
    repo.mockType = "full";
    repo.saved = [{ questionId: qid(1), selected: "B", flagged: false, notes: "", seconds: 0, confidence: null }];
    vi.spyOn(MockRepository, "fromEnv").mockReturnValue(repo as unknown as MockRepository);
    const brk = find(await render(), MockBreak);
    expect(brk).not.toBeNull();
    expect(brk!.props.remainingMs as number).toBeLessThan(26 * 60_000);
    expect(repo.attemptRow.session).toBe(2);
  });
});
