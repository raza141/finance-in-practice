import { CsvText } from "@/domains/journal/services/ChartData";

import { MockExhibits } from "./MockExhibits";
import type { MockAccess, MockAudience, MockExamInput, MockQuestionInput, MockResponse, MockType, OptionLetter } from "../types";

/** How many random questions to draw per topic, plus questions ticked by hand; `from` limits the draw to those mocks (empty: all). */
export type PoolPick = { quotas: { topic: string; count: number }[]; ids: string[]; from: string[] };

export type SheetResult = { ok: true; questions: MockQuestionInput[] } | { ok: false; errors: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Header cell -> field, after lower-casing and dropping "(Optional)", spaces and underscores. */
const COLUMNS = {
  number: "number",
  no: "number",
  topic: "topic",
  vignette: "vignette",
  question: "question",
  optiona: "a",
  optionb: "b",
  optionc: "c",
  correctoption: "correct",
  correct: "correct",
  explanation: "explanation",
} as const;
type Column = (typeof COLUMNS)[keyof typeof COLUMNS];
const REQUIRED: Column[] = ["number", "topic", "question", "a", "b", "c", "correct"];

/** Admin input for mock exams: the exam form, the question sheet, and a student's answers. */
export class MockContract {
  static readonly TYPES: Record<MockType, string> = {
    book: "Book specific",
    topic: "Topic specific",
    random: "Random mock",
    full: "Full syllabus",
  };
  static readonly AUDIENCES: Record<MockAudience, string> = {
    all: "All students",
    course: "Students on certain courses",
    clients: "Selected clients only",
  };
  static readonly LETTERS: readonly OptionLetter[] = ["A", "B", "C"];
  static readonly MAX_QUESTIONS = 500;
  /** The optional break between a full mock's sessions (the CFA exam's is about 30 minutes). */
  static readonly BREAK_MINUTES = 30;

  /** A full-syllabus mock sits like the CFA exam: two timed sessions, each the mock's duration. Every other type is one sitting. */
  static sessions(mock: { mockType: MockType }): 1 | 2 {
    return mock.mockType === "full" ? 2 : 1;
  }
  static readonly MAX_NOTES = 5000;
  /** The CFA exam's pace: 135 minutes for 90 questions. */
  static readonly MINUTES_PER_QUESTION = 1.5;

  /** The suggested duration for `count` questions; a full mock's is per session, so half the questions. */
  static minutes(count: number, mockType: MockType): number {
    const sitting = MockContract.sessions({ mockType }) === 2 ? Math.ceil(count / 2) : count;
    return Math.min(600, Math.max(1, Math.ceil(sitting * MockContract.MINUTES_PER_QUESTION)));
  }

  static isUuid(id: unknown): id is string {
    return typeof id === "string" && UUID.test(id);
  }

  static isLetter(value: unknown): value is OptionLetter {
    return value === "A" || value === "B" || value === "C";
  }

  static parseExam(form: FormData): { ok: true; value: MockExamInput } | { ok: false; error: string } {
    const title = String(form.get("title") ?? "").trim();
    const mockType = String(form.get("mockType") ?? "");
    const source = String(form.get("source") ?? "").trim();
    const durationMinutes = Number(form.get("durationMinutes"));
    if (title.length < 3 || title.length > 120) return { ok: false, error: "The title needs 3 to 120 characters." };
    if (!(mockType in MockContract.TYPES)) return { ok: false, error: "Pick a mock type." };
    if (source.length > 120) return { ok: false, error: "Keep the book or source under 120 characters." };
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 600) {
      return { ok: false, error: "The duration is whole minutes, 1 to 600." };
    }
    return { ok: true, value: { title, mockType: mockType as MockType, source, durationMinutes } };
  }

  /** The access form. Only the list the chosen audience uses is kept, and it can't be empty. */
  static parseAccess(form: FormData): { ok: true; value: MockAccess } | { ok: false; error: string } {
    const audience = String(form.get("audience") ?? "");
    if (!(audience in MockContract.AUDIENCES)) return { ok: false, error: "Choose who can take this mock." };
    const courses = [...new Set(form.getAll("course").map((c) => String(c).trim()))].filter(Boolean).slice(0, 50);
    const clients = [...new Set(form.getAll("client").map(String))].filter(MockContract.isUuid);
    if (audience === "course" && !courses.length) return { ok: false, error: "Tick at least one course." };
    if (audience === "clients" && !clients.length) return { ok: false, error: "Tick at least one client." };
    return {
      ok: true,
      value: { audience: audience as MockAudience, courses: audience === "course" ? courses : [], clients: audience === "clients" ? clients : [] },
    };
  }

  /** The pool form: a number per topic (blank or 0: none), ticked question ids, and optionally which mocks to draw from (none: every mock). */
  static parsePool(form: FormData): { ok: true; value: PoolPick } | { ok: false; error: string } {
    const counts = form.getAll("count").map((c) => String(c).trim());
    const seen = new Set<string>();
    const quotas: PoolPick["quotas"] = [];
    for (const [i, name] of form.getAll("topic").entries()) {
      const topic = String(name).trim();
      const count = counts[i] ? Number(counts[i]) : 0;
      if (!Number.isInteger(count) || count < 0) return { ok: false, error: `The number for ${topic} is a whole number.` };
      if (!topic || count === 0 || seen.has(topic.toLowerCase())) continue;
      seen.add(topic.toLowerCase());
      quotas.push({ topic, count });
    }
    const ids = [...new Set(form.getAll("q").map(String))].filter(MockContract.isUuid);
    const from = form.getAll("from").map(String).filter(MockContract.isUuid);
    if (!quotas.length && !ids.length) return { ok: false, error: "Give a topic a number of questions, or tick some." };
    if (quotas.reduce((n, q) => n + q.count, 0) > MockContract.MAX_QUESTIONS || ids.length > MockContract.MAX_QUESTIONS) {
      return { ok: false, error: `At most ${MockContract.MAX_QUESTIONS} questions per mock.` };
    }
    return { ok: true, value: { quotas, ids, from } };
  }

  /** One question's problems (sheet row or the admin's question form), as "Question is empty". */
  static questionProblems(at: (c: Column) => string): string[] {
    const problems: string[] = [];
    const number = Number(at("number"));
    if (!Number.isInteger(number) || number < 1 || number > MockContract.MAX_QUESTIONS) problems.push(`Number "${at("number")}" is not 1 to 500`);
    if (!MockContract.isLetter(at("correct").toUpperCase())) problems.push(`Correct_Option must be A, B or C (got "${at("correct")}")`);
    const limits: [Column, string, number][] = [
      ["topic", "Topic", 80],
      ["question", "Question", 5000],
      ["a", "Option_A", 2000],
      ["b", "Option_B", 2000],
      ["c", "Option_C", 2000],
    ];
    for (const [c, label, max] of limits) {
      if (!at(c)) problems.push(`${label} is empty`);
      else if (at(c).length > max) problems.push(`${label} is over ${max} characters`);
    }
    if (at("vignette").length > 20000) problems.push("Vignette is over 20000 characters");
    if (at("explanation").length > 10000) problems.push("Explanation is over 10000 characters");
    for (const [c, label] of [["vignette", "Vignette"], ["question", "Question"], ["explanation", "Explanation"]] as const) problems.push(...MockExhibits.problems(at(c), label));
    return problems;
  }

  /** The admin's one-question form (fields named as the sheet's columns: number, topic, vignette, question, a, b, c, correct, explanation). */
  static parseQuestion(form: FormData): { ok: true; value: MockQuestionInput } | { ok: false; errors: string[] } {
    const at = (c: Column) => String(form.get(c) ?? "").trim();
    const problems = MockContract.questionProblems(at);
    if (problems.length) return { ok: false, errors: problems };
    return { ok: true, value: MockContract.toInput(at) };
  }

  private static toInput(at: (c: Column) => string): MockQuestionInput {
    return {
      number: Number(at("number")),
      topic: at("topic"),
      vignette: at("vignette"),
      question: at("question"),
      options: [at("a"), at("b"), at("c")],
      correct: at("correct").toUpperCase() as OptionLetter,
      explanation: at("explanation"),
    };
  }

  /**
   * A CSV file, or rows copied straight out of Excel (tab-separated). Columns, in any order:
   * Number | Topic | Vignette (Optional) | Question | Option_A | Option_B | Option_C | Correct_Option | Explanation (Optional).
   * Every bad row is reported, so the admin can fix the sheet in one go.
   */
  static parseSheet(text: string): SheetResult {
    const rows = CsvText.parse(text.replace(/^﻿/, ""));
    if (rows.length < 2) return { ok: false, errors: ["The sheet needs a header row and at least one question."] };
    const [header, ...data] = rows;
    const index = new Map<Column, number>();
    header.forEach((cell, i) => {
      const key = cell.toLowerCase().replace(/\(optional\)/g, "").replace(/[^a-z]/g, "") as keyof typeof COLUMNS;
      if (key in COLUMNS && !index.has(COLUMNS[key])) index.set(COLUMNS[key], i);
    });
    const missing = REQUIRED.filter((c) => !index.has(c));
    if (missing.length) return { ok: false, errors: [`Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`] };

    const errors: string[] = [];
    const questions: MockQuestionInput[] = [];
    const seen = new Set<number>();
    for (const [i, row] of data.entries()) {
      if (row.every((cell) => cell === "")) continue;
      const at = (c: Column) => (index.has(c) ? (row[index.get(c)!] ?? "") : "");
      const problems = MockContract.questionProblems(at);
      const number = Number(at("number"));
      if (seen.has(number)) problems.unshift(`Number ${number} is used twice`);
      if (problems.length) {
        errors.push(`Row ${i + 2}: ${problems.join("; ")}.`);
        continue;
      }
      seen.add(number);
      questions.push(MockContract.toInput(at));
    }
    if (errors.length) return { ok: false, errors };
    if (questions.length === 0) return { ok: false, errors: ["The sheet has no questions."] };
    if (questions.length > MockContract.MAX_QUESTIONS) return { ok: false, errors: [`At most ${MockContract.MAX_QUESTIONS} questions per mock.`] };
    return { ok: true, questions: questions.sort((a, b) => a.number - b.number) };
  }

  /** A student's answers from the browser; anything malformed is dropped, never trusted. */
  static parseResponses(input: unknown): MockResponse[] {
    if (!Array.isArray(input)) return [];
    const seen = new Set<string>();
    return input.slice(0, MockContract.MAX_QUESTIONS).flatMap((r): MockResponse[] => {
      if (typeof r !== "object" || r === null) return [];
      const { questionId, selected, flagged, notes } = r as Record<string, unknown>;
      if (!MockContract.isUuid(questionId) || seen.has(questionId)) return [];
      seen.add(questionId);
      return [
        {
          questionId,
          selected: MockContract.isLetter(selected) ? selected : null,
          flagged: flagged === true,
          notes: typeof notes === "string" ? notes.slice(0, MockContract.MAX_NOTES) : "",
        },
      ];
    });
  }
}
