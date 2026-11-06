"use server";

import { redirect } from "next/navigation";

import { StudentAuth } from "../server/StudentAuth";
import { StudyPlanRepository } from "../server/StudyPlanRepository";
import { StudyLine } from "../services/StudyLine";

/** The signed-in student spreads their unfinished topics from tomorrow to exam day (StudyLine.replan). Their own plan only, from their session. */
export async function replanToExam(): Promise<void> {
  const me = await StudentAuth.current();
  if (!me) redirect("/student");
  const repo = StudyPlanRepository.fromEnv();
  const exam = await repo?.nextExam(me.id);
  if (repo && exam) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
    await repo.replan(me.id, StudyLine.replan(await repo.forClient(me.id), today, exam.date));
  }
  redirect("/student?tab=plan");
}
