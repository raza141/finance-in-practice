import { isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MockAttemptPage from "@/app/student/mocks/[attemptId]/page";
import type { Sql } from "@/core/db/Database";

import { submitMock } from "../actions/mocks";
import { AttemptResults } from "../components/AttemptResults";
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
const qid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

const QUESTIONS: MockQuestion[] = [
  { id: qid(1), number: 1, topic: "FSA", vignette: "Alder Corp: EBIT $40$m.", question: "FCFF?", options: ["$142.5m", "$158.0m", "$164.2m"], correct: "B", explanation: "SECRET-1: add back D&A." },
  { id: qid(2), number: 2, topic: "FSA", vignette: "", question: "Quick ratio?", options: ["0.8", "1.1", "1.4"], correct: "A", explanation: "SECRET-2" },
  { id: qid(3), number: 3, topic: "Quant", vignette: "", question: "$\\sigma$ of the sample?", options: ["2", "4", "16"], correct: "A", explanation: "SECRET-3" },
];

/** The repository in memory: what the page and the actions read and write. */
class FakeRepo {
  attemptRow: MockAttempt;
  saved: MockResponse[] = [];
  completed: { grade: MockGrade; responses: MockResponse[] } | null = null;

  constructor(endsAt: Date) {
    this.attemptRow = { id: ATTEMPT, clientId: CLIENT, mockId: MOCK, startedAt: new Date(Date.now() - 600_000), endsAt, submittedAt: null, score: null, total: 3, status: "in_progress" };
  }
  async attempt(id: string, clientId: string) {
    return id === ATTEMPT && clientId === CLIENT ? { ...this.attemptRow } : null;
  }
  async byId() {
    return { id: MOCK, title: "Book 3 · FSA", mockType: "book", source: "Book 3", durationMinutes: 135, published: true, questionCount: 3, attempted: true, createdAt: new Date() };
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
    { questionId: qid(1), selected: "B", flagged: true, notes: "FCFF = EBIT(1-t) + D&A - capex - ΔWC" },
    { questionId: qid(2), selected: "C", flagged: false, notes: "" },
    { questionId: qid(3), selected: null, flagged: true, notes: "revise std dev" },
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
    await submitMock(ATTEMPT, [{ questionId: qid(2), selected: "A", flagged: false, notes: "" }]);
    expect(repo.completed).toBe(first);
  });

  it("after the clock, a late answer doesn't count but its notes do", async () => {
    repo = new FakeRepo(new Date(Date.now() - 5 * 60_000));
    repo.saved = [{ questionId: qid(2), selected: "C", flagged: false, notes: "" }];
    vi.spyOn(MockRepository, "fromEnv").mockReturnValue(repo as unknown as MockRepository);
    await submitMock(ATTEMPT, [{ questionId: qid(2), selected: "A", flagged: true, notes: "should have been A" }]);
    expect(repo.completed?.grade.score).toBe(0);
    expect(repo.completed?.responses).toEqual([{ questionId: qid(2), selected: "C", flagged: true, notes: "should have been A" }]);
  });

  it("coming back to an attempt whose clock ran out closes it from the autosaved answers", async () => {
    repo = new FakeRepo(new Date(Date.now() - 5 * 60_000));
    repo.saved = [{ questionId: qid(1), selected: "B", flagged: false, notes: "kept" }];
    vi.spyOn(MockRepository, "fromEnv").mockReturnValue(repo as unknown as MockRepository);
    const results = await resultsOf(await render());
    expect(results).not.toBeNull();
    expect(repo.completed?.grade.score).toBe(1);
    // Started 10 minutes ago, clock ended 5 minutes ago: 5 minutes taken, not the time until the revisit.
    expect(results!.props.seconds).toBeCloseTo(300, 0);
  });
});
