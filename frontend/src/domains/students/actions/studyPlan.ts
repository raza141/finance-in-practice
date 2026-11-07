"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { MockRepository } from "@/domains/mocks/server/MockRepository";

import { StudyPlanRepository } from "../server/StudyPlanRepository";
import { StudyPlanContract } from "../services/StudyPlanContract";

/** Admin edits to a student's study plan (shown on /student). Each action re-checks the owner session. */

async function plan(formData: FormData): Promise<{ repo: StudyPlanRepository; clientId: string; path: string }> {
  await AdminAuth.requireOwner();
  const repo = StudyPlanRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  const clientId = String(formData.get("clientId"));
  return { repo, clientId, path: `/admin/clients/${clientId}` };
}

const refused = (path: string, error: string): never =>
  redirect(`${path}?notice=plan-refused&reason=${encodeURIComponent(error)}#study-plan`);

export async function addStudyTopics(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await plan(formData);
  const parsed = StudyPlanContract.parseLines(String(formData.get("lines") ?? ""));
  if (!parsed.ok) refused(path, parsed.error);
  else await repo.add(clientId, parsed.value);
  redirect(`${path}?notice=plan-saved#study-plan`);
}

/** A mock on a day of the plan: the student's calendar starts it from there. Named after the mock. */
export async function addStudyMock(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await plan(formData);
  const mockId = String(formData.get("mockId") ?? "");
  const mock = /^[0-9a-f-]{36}$/i.test(mockId) ? await MockRepository.fromEnv()?.byId(mockId) : null;
  if (!mock) refused(path, "Choose a mock from the list.");
  const parsed = StudyPlanContract.parseItem({ dueOn: formData.get("dueOn"), topic: mock!.title, status: "planned", mockId });
  if (!parsed.ok) refused(path, parsed.error);
  else await repo.add(clientId, [parsed.value]);
  redirect(`${path}?notice=plan-saved#study-plan`);
}

export async function updateStudyTopic(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await plan(formData);
  const parsed = StudyPlanContract.parseItem(Object.fromEntries(formData));
  if (!parsed.ok) refused(path, parsed.error);
  else await repo.update(clientId, String(formData.get("itemId")), parsed.value);
  redirect(`${path}?notice=plan-saved#study-plan`);
}

export async function removeStudyTopic(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await plan(formData);
  await repo.remove(clientId, String(formData.get("itemId")));
  redirect(`${path}?notice=plan-saved#study-plan`);
}
