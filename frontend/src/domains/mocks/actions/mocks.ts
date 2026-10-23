"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

import { MockSession } from "../server/MockSession";
import { MockContract } from "../services/MockContract";

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

/** The player's periodic save. `open` false: the attempt is closed or its clock ran out, so the player submits. */
export async function autosaveMock(attemptId: string, responses: unknown): Promise<{ open: boolean }> {
  const { id: clientId } = await student();
  if (!MockContract.isUuid(attemptId)) return { open: false };
  return { open: await MockSession.repo().autosave(attemptId, clientId, MockContract.parseResponses(responses)) };
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

// --- Admin ---

/** Create (no id) or update the mock's details. */
export async function saveMock(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const parsed = MockContract.parseExam(form);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const id = String(form.get("id") ?? "");
  const repo = MockSession.repo();
  if (!id) redirect(`/admin/mocks/${await repo.create(parsed.value)}`);
  if (!MockContract.isUuid(id)) return { ok: false, message: "Unknown mock." };
  await repo.update(id, parsed.value);
  refresh();
  return { ok: true, message: "Saved." };
}

/** The question sheet: a .csv file, or rows pasted from Excel. Replaces every question until someone starts the mock. */
export async function uploadMockQuestions(_prev: MockActionState, form: FormData): Promise<MockActionState> {
  await AdminAuth.require();
  const id = String(form.get("id"));
  if (!MockContract.isUuid(id)) return { ok: false, message: "Unknown mock." };
  const file = form.get("file");
  const text = file instanceof File && file.size > 0 ? await file.text() : String(form.get("paste") ?? "");
  if (!text.trim()) return { ok: false, message: "Choose a .csv file or paste the rows from Excel." };
  const sheet = MockContract.parseSheet(text);
  if (!sheet.ok) return { ok: false, message: "Nothing was saved. Fix these rows and upload again:", errors: sheet.errors };
  const saved = await MockSession.repo().replaceQuestions(id, sheet.questions);
  if (!saved) return { ok: false, message: "Students have already started this mock, so its questions are fixed. Make a new mock instead." };
  refresh();
  return { ok: true, message: `Saved ${sheet.questions.length} questions.` };
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
  if (MockContract.isUuid(id) && !(await MockSession.repo().remove(id))) redirect(`/admin/mocks/${id}?notice=attempted`);
  redirect("/admin/mocks");
}
