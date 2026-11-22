"use server";

import { revalidatePath } from "next/cache";

import { StudentAuth } from "@/domains/students/server/StudentAuth";

import { AccountabilityRepository } from "../server/AccountabilityRepository";
import { StudyGoalContract } from "../services/StudyGoalContract";
import { StudySchedule } from "../services/StudySchedule";
import type { FormResult } from "../types";

/** The student's own plan and log (077). Always theirs, from their session, never the form. */

const SIGNED_OUT = { ok: false, message: "Sign in again." } as const;

export async function saveStudyGoal(_: FormResult, form: FormData): Promise<FormResult> {
  const me = await StudentAuth.current();
  const repo = AccountabilityRepository.fromEnv();
  if (!me || !repo) return SIGNED_OUT;
  const options = await repo.options(me.id);
  const parsed = StudyGoalContract.goal(form, options);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const level = options.find((o) => o.course === parsed.value.course)!.level;
  if (!(await repo.saveGoal(me.id, level, parsed.value))) return { ok: false, message: "Couldn't save. Pick another time zone or refresh." };
  revalidatePath("/student");
  return { ok: true, message: "Saved." };
}

export async function logStudyTime(_: FormResult, form: FormData): Promise<FormResult> {
  const me = await StudentAuth.current();
  const repo = AccountabilityRepository.fromEnv();
  if (!me || !repo) return SIGNED_OUT;
  const [facts] = await repo.facts(me.id);
  if (!facts?.goal.live) return { ok: false, message: "Set your study goal first." };
  const parsed = StudyGoalContract.log(form, new StudySchedule(facts.schedule).today());
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const saved = await repo.addLog(me.id, facts.goal.course, parsed.value);
  if (saved === "over_cap") return { ok: false, message: "That's over 8 hours for that day." };
  if (saved === "refused") return { ok: false, message: "Couldn't save. Refresh and try again." };
  revalidatePath("/student");
  return { ok: true, message: "Logged." };
}

export async function removeStudyTime(form: FormData): Promise<void> {
  const me = await StudentAuth.current();
  const repo = AccountabilityRepository.fromEnv();
  if (!me || !repo) return;
  if (await repo.removeLog(me.id, String(form.get("id") ?? ""))) revalidatePath("/student");
}
