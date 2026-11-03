"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

import { MockSession } from "../server/MockSession";
import { MockContract } from "../services/MockContract";
import { MockGrader } from "../services/MockGrader";
import { MockNotebook } from "../services/MockNotebook";

export type MockActionState = { ok: boolean; message: string; errors?: string[] } | null;

// --- Students: every action reads the student from their own session, never the form ---

async function student() {
  const s = await StudentAuth.current();
  if (!s) redirect("/student");
  return s;
}

/** Starts the mock (or reopens the student's open attempt at it) on its own page, so a refresh keeps the exam. */
export async function startMock(form: FormData): Promise<void> {
  const { id: clientId } = await student();
  const mockId = String(form.get("mockId"));
  const attemptId = MockContract.isUuid(mockId) ? await MockSession.repo().start(clientId, mockId) : null;
  redirect(attemptId ? `/student/mocks/${attemptId}` : "/student");
}

/**
 * A new attempt at only what went wrong in one of the student's closed attempts (incorrect, unanswered or
 * flagged), timed at the mock's pace. Picked here from the stored answers, never from the browser.
 */
export async function retakeMistakes(form: FormData): Promise<void> {
  const { id: clientId } = await student();
  const from = String(form.get("attemptId"));
  const repo = MockSession.repo();
  const attempt = MockContract.isUuid(from) ? await repo.attempt(from, clientId) : null;
  if (attempt?.status !== "completed") redirect(attempt ? `/student/mocks/${attempt.id}` : "/student");
  const [{ all }, responses, mock] = await Promise.all([MockSession.questions(repo, attempt), repo.responses(attempt.id), repo.byId(attempt.mockId)]);
  const questionIds = MockGrader.mistakes(all, responses);
  const attemptId = mock && questionIds.length ? await repo.start(clientId, mock.id, { questionIds, minutes: MockContract.retakeMinutes(mock, questionIds.length) }) : null;
  revalidatePath("/student");
  redirect(attemptId ? `/student/mocks/${attemptId}` : `/student/mocks/${attempt.id}`);
}

/**
 * "10 more from my weakest topic": fresh practice questions (none they've met) from the bank, trying their
 * weakest topics in turn until one has some. Starts it at once.
 */
export async function drillWeakestTopic(): Promise<void> {
  const { id: clientId } = await student();
  const repo = MockSession.repo();
  for (const t of (await repo.weakTopics(clientId)).slice(0, 5)) {
    const exam = { title: `Drill: ${t.topic}`, mockType: "topic" as const, source: "Weakest topic", level: t.level, durationMinutes: MockContract.minutes(MockContract.DRILL_SIZE, "topic", t.level) };
    const id = await repo.drill(clientId, exam, { quotas: [{ topic: t.topic, count: MockContract.DRILL_SIZE }], ids: [], chapter: "", avoid: [clientId] });
    if (id) redirect(`/student/mocks/${await repo.start(clientId, id)}`);
  }
  redirect("/student/mocks/notebook?notice=no-drill");
}

/** A practice run of the notebook's newest questions (`MockNotebook.practice`), timed at the CFA pace. */
export async function practiceNotebook(): Promise<void> {
  const { id: clientId } = await student();
  const repo = MockSession.repo();
  const book = MockNotebook.practice(MockNotebook.build(await repo.notebookRows(clientId)));
  const level = book.filter((e) => e.level === 2).length > book.length / 2 ? 2 : 1;
  const minutes = Math.min(600, Math.ceil(book.reduce((n, e) => n + MockContract.MINUTES_PER_QUESTION[e.level], 0)));
  const exam = { title: `Mistakes notebook: ${book.length} question${book.length === 1 ? "" : "s"}`, mockType: "topic" as const, source: "Mistakes notebook", level, durationMinutes: Math.max(1, minutes) } as const;
  const id = book.length ? await repo.drill(clientId, exam, book.map((e) => e.id)) : null;
  redirect(id ? `/student/mocks/${await repo.start(clientId, id)}` : "/student/mocks/notebook");
}

/** The player's periodic save. `open` false: the attempt (or its session) is closed or its clock ran out, so the player submits. */
export async function autosaveMock(attemptId: string, responses: unknown): Promise<{ open: boolean }> {
  const { id: clientId } = await student();
  if (!MockContract.isUuid(attemptId)) return { open: false };
  const repo = MockSession.repo();
  const attempt = await repo.attempt(attemptId, clientId);
  if (attempt?.status !== "in_progress") return { open: false };
  // Only the session the attempt is in: a full mock's first half is locked once its break starts.
  const { current } = await MockSession.questions(repo, attempt);
  return { open: await repo.autosave(attemptId, clientId, MockSession.only(MockContract.parseResponses(responses), current), attempt.session) };
}

/** Ends a full mock's break early: session 2's clock starts now. */
/** Saves what the browser has, then stops the clock. */
export async function pauseMock(attemptId: string, responses: unknown): Promise<{ ok: boolean }> {
  const { id: clientId } = await student();
  if (!MockContract.isUuid(attemptId)) return { ok: false };
  await autosaveMock(attemptId, responses);
  return { ok: await MockSession.repo().pause(attemptId, clientId) };
}

/** Restarts the clock; the player carries on from the server's new end time. Null: the attempt isn't open any more. */
export async function resumeMock(attemptId: string): Promise<{ remainingMs: number | null }> {
  const { id: clientId } = await student();
  if (!MockContract.isUuid(attemptId)) return { remainingMs: null };
  const repo = MockSession.repo();
  await repo.resume(attemptId, clientId);
  const attempt = await repo.attempt(attemptId, clientId);
  return { remainingMs: attempt?.status === "in_progress" && !attempt.pausedAt ? MockGrader.remainingMs(attempt.endsAt) : null };
}

export async function startNextSession(form: FormData): Promise<void> {
  const { id: clientId } = await student();
  const attemptId = String(form.get("attemptId"));
  if (MockContract.isUuid(attemptId)) await MockSession.repo().startSession(attemptId, clientId);
  redirect(MockContract.isUuid(attemptId) ? `/student/mocks/${attemptId}` : "/student");
}

/** Grades and closes the attempt; the page then re-renders as the results. A repeat submit is a no-op. */
export async function submitMock(attemptId: string, responses: unknown): Promise<{ ok: boolean }> {
  const { id: clientId } = await student();
  if (!MockContract.isUuid(attemptId)) return { ok: false };
  const repo = MockSession.repo();
  const attempt = await repo.attempt(attemptId, clientId);
  if (!attempt) return { ok: false };
  if (attempt.status === "in_progress") await MockSession.finish(repo, attempt, MockContract.parseResponses(responses));
  revalidatePath("/student");
  return { ok: true };
}

/** Revision notes, editable on the results page. */
export async function saveMockNote(attemptId: string, questionId: string, notes: string): Promise<{ ok: boolean }> {
  const { id: clientId } = await student();
  if (!MockContract.isUuid(attemptId) || !MockContract.isUuid(questionId) || typeof notes !== "string") return { ok: false };
  return { ok: await MockSession.repo().saveNote(attemptId, clientId, questionId, notes.slice(0, MockContract.MAX_NOTES)) };
}

// --- Admin: assessments ---

/** Create (no id) or update the assessment's details. A new one is an empty draft; its questions come from the bank. */
export async function saveMock(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const id = String(form.get("id") ?? "");
  const parsed = MockContract.parseExam(form);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const repo = MockSession.repo();
  if (!id) redirect(`/admin/mocks/${await repo.create(parsed.value)}`);
  if (!MockContract.isUuid(id)) return { ok: false, message: "Unknown mock." };
  await repo.update(id, parsed.value);
  refresh();
  return { ok: true, message: "Saved." };
}

/** A new draft, details and questions together, from the Design a mock page; opens it for the preview. */
export async function designMock(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const exam = MockContract.parseExam(form);
  if (!exam.ok) return { ok: false, message: exam.error };
  const pick = MockContract.parsePool(form);
  if (!pick.ok) return { ok: false, message: pick.error };
  const id = await MockSession.repo().buildFromBank(exam.value, pick.value);
  if (!id) return { ok: false, message: "No bank questions match those books and ticks." };
  redirect(`/admin/mocks/${id}`);
}

/** Adds to an assessment from the bank: ticked questions and random ones by topic. */
export async function addMockQuestions(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  const repo = MockSession.repo();
  const mock = MockContract.isUuid(id) ? await repo.byId(id) : null;
  if (!mock) return { ok: false, message: "Unknown mock." };
  if (mock.attempted) return { ok: false, message: "Students have started this mock, so its questions are fixed." };
  const pick = MockContract.parsePool(form);
  if (!pick.ok) return { ok: false, message: pick.error };
  const added = await repo.addFromBank(mock, pick.value);
  if (!added) return { ok: false, message: "No bank questions match those topics and ticks." };
  revalidatePath("/student");
  redirect(`/admin/mocks/${id}`);
}

export async function removeMockQuestion(form: FormData): Promise<void> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  const questionId = String(form.get("questionId"));
  if (MockContract.isUuid(id) && MockContract.isUuid(questionId)) await MockSession.repo().removeItem(id, questionId);
  revalidatePath("/student");
  refresh();
}

export async function moveMockQuestion(form: FormData): Promise<void> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  const questionId = String(form.get("questionId"));
  if (MockContract.isUuid(id) && MockContract.isUuid(questionId)) await MockSession.repo().moveItem(id, questionId, form.get("direction") === "up" ? "up" : "down");
  refresh();
}

// --- Admin: the question bank ---

/** The question sheet: a .csv file, or rows pasted from Excel. Adds to the bank; nothing joins an assessment until it's picked. */
export async function uploadBankQuestions(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const file = form.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(form.get("paste") ?? "");
  if (!text.trim()) return { ok: false, message: "Choose a .csv file or paste the rows from Excel." };
  const usage = form.get("usage");
  const level = Number(form.get("level"));
  const sheet = MockContract.parseSheet(text, MockContract.isUsage(usage) ? usage : "mock", MockContract.isLevel(level) ? level : 1);
  if (!sheet.ok) return { ok: false, message: "Nothing was saved. Fix these rows and upload again:", errors: sheet.errors };
  const { added, skipped } = await MockSession.repo().importQuestions(sheet.questions);
  refresh();
  return { ok: true, message: `Added ${added} question${added === 1 ? "" : "s"}.${skipped ? ` ${skipped} already in the bank, skipped.` : ""}` };
}

/** Adds or edits one bank question (the way in for exhibit-heavy questions, or a typo). */
export async function saveBankQuestion(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const questionId = String(form.get("questionId") ?? "");
  if (questionId && !MockContract.isUuid(questionId)) return { ok: false, message: "Unknown question." };
  const parsed = MockContract.parseQuestion(form);
  if (!parsed.ok) return { ok: false, message: "Nothing was saved. Fix these and save again:", errors: parsed.errors };
  const saved = await MockSession.repo().saveQuestion(questionId || null, parsed.value);
  if (saved === "locked") return { ok: false, message: "Students have started a mock with this question, so only its chapter, use, level, explanation and why notes can change. Use Copy to make an edited version." };
  if (saved === "duplicate") return { ok: false, message: "The bank already has this question. Change the wording, options or answer." };
  revalidatePath("/student");
  // Back to the search the question was found from.
  const back = String(form.get("back") ?? "");
  redirect(back.startsWith("/admin/mocks/bank?") ? back : "/admin/mocks/bank");
}

export async function deleteBankQuestion(form: FormData): Promise<void> {
  await AdminAuth.require();
  const questionId = String(form.get("questionId"));
  const deleted = MockContract.isUuid(questionId) && (await MockSession.repo().deleteQuestion(questionId));
  redirect(deleted ? "/admin/mocks/bank" : "/admin/mocks/bank?notice=used");
}

/** The bank's bulk bar: retire, restore, or set the ticked questions' chapter or where they may be used. */
export async function updateBankQuestions(form: FormData): Promise<void> {
  await AdminAuth.require();
  const ids = form.getAll("q").map(String).filter(MockContract.isUuid);
  const op = form.get("op");
  const repo = MockSession.repo();
  if (ids.length && (op === "retire" || op === "restore")) await repo.setRetired(ids, op === "retire");
  else if (ids.length && op === "chapter") await repo.setChapter(ids, String(form.get("chapter") ?? "").trim().slice(0, 80));
  else if (ids.length && MockContract.isUsage(op)) await repo.setUsage(ids, op);
  refresh();
}

/** Who can see and start the mock. Students already part-way through keep their attempt. */
export async function setMockAccess(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  if (!MockContract.isUuid(id)) return { ok: false, message: "Unknown mock." };
  const access = MockContract.parseAccess(form);
  if (!access.ok) return { ok: false, message: access.error };
  await MockSession.repo().setAccess(id, access.value);
  revalidatePath("/student");
  refresh();
  return { ok: true, message: "Saved." };
}

/** A client's access to a product or one mock, from their client page. */
export async function addAccessGrant(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const clientId = String(form.get("clientId"));
  if (!MockContract.isUuid(clientId)) return { ok: false, message: "Unknown client." };
  const grant = MockContract.parseGrant(form);
  if (!grant.ok) return { ok: false, message: grant.error };
  await MockSession.repo().addGrant(clientId, grant.value);
  revalidatePath("/student");
  refresh();
  return { ok: true, message: "Granted." };
}

export async function endAccessGrant(form: FormData): Promise<void> {
  await AdminAuth.require();
  const clientId = String(form.get("clientId"));
  const grantId = String(form.get("grantId"));
  if (MockContract.isUuid(clientId) && MockContract.isUuid(grantId)) await MockSession.repo().endGrant(clientId, grantId);
  revalidatePath("/student");
  refresh();
}

export async function setMockPublished(form: FormData): Promise<void> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  if (MockContract.isUuid(id)) await MockSession.repo().setPublished(id, form.get("on") === "1");
  revalidatePath("/student");
  refresh();
}

export async function deleteMock(form: FormData): Promise<void> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  if (MockContract.isUuid(id) && !(await MockSession.repo().remove(id, form.get("withAttempts") === "1"))) redirect(`/admin/mocks/${id}?notice=attempted`);
  revalidatePath("/student");
  redirect("/admin/mocks");
}

/** Clears finished attempts from the activity badge: one (`attemptId`) or all. */
export async function markMockAttemptsSeen(form: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const id = String(form.get("attemptId") ?? "");
  await MockSession.repo().markSeen(MockContract.isUuid(id) ? [id] : null);
  refresh();
}
