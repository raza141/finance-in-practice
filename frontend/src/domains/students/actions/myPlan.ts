"use server";

import { revalidatePath } from "next/cache";

import { StudentAuth } from "../server/StudentAuth";
import { StudyPlanRepository } from "../server/StudyPlanRepository";
import { Batches } from "../services/Batches";
import { StudyDays } from "../services/StudyDays";

/** The student's own study calendar (070). Always their own plan, from their session, never the form. */

/** Move a topic to `dueOn` (yyyy-mm-dd), from today up to exam day (a year ahead with no exam). */
export async function moveStudyTopic(id: string, dueOn: string): Promise<{ ok: boolean }> {
  const me = await StudentAuth.current();
  const repo = StudyPlanRepository.fromEnv();
  if (!me || !repo || typeof id !== "string" || typeof dueOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dueOn)) return { ok: false };
  const today = StudyDays.today();
  const last = (await repo.nextExam(me.id))?.date ?? StudyDays.addDays(today, 366);
  if (dueOn < today || dueOn > last || Number.isNaN(Date.parse(dueOn))) return { ok: false };
  // No page refresh: the calendar has already moved it on screen, and a refresh would reload the whole portal (Cal.com included).
  return { ok: await repo.moveByStudent(me.id, id, dueOn) };
}

export async function setStudyTopicDone(id: string, done: boolean): Promise<{ ok: boolean }> {
  const me = await StudentAuth.current();
  const repo = StudyPlanRepository.fromEnv();
  if (!me || !repo || typeof id !== "string" || typeof done !== "boolean") return { ok: false };
  return { ok: await repo.setDoneByStudent(me.id, id, done) };
}

/** Hide or show the days-to-exam countdown. No page refresh: the countdown has already changed on screen. */
export async function setExamCountdownHidden(hidden: boolean): Promise<{ ok: boolean }> {
  const me = await StudentAuth.current();
  const repo = StudyPlanRepository.fromEnv();
  if (!me || !repo || typeof hidden !== "boolean") return { ok: false };
  return { ok: await repo.setCountdownHidden(me.id, hidden) };
}

/** The student's own exam day for their next exam (071): inside their batch's window; their portal closes 5 days after. */
export async function setMyExamDate(formData: FormData): Promise<void> {
  const me = await StudentAuth.current();
  const repo = StudyPlanRepository.fromEnv();
  const date = String(formData.get("date") ?? "");
  if (!me || !repo || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return;
  const exam = await repo.nextExam(me.id);
  if (!exam) return;
  const { min, max } = Batches.examPick(exam.batchDate, StudyDays.today());
  if (date < min || date > max) return;
  await repo.setExamDate(me.id, exam.course, date);
  revalidatePath("/student");
}
