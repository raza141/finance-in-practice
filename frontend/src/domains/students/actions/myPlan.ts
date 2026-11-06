"use server";

import { StudentAuth } from "../server/StudentAuth";
import { StudyPlanRepository } from "../server/StudyPlanRepository";
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
