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

/**
 * A book over a range, with its half-book test, full-book test and book mock on their days (each optional,
 * each may start a mock). All or nothing, so a bad date never leaves half a book on the calendar.
 */
export async function addStudyBook(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await plan(formData);
  const text = (name: string) => String(formData.get(name) ?? "").trim();
  const book = text("book");
  if (!StudyPlanContract.isBook(book)) refused(path, "Choose a book.");
  const short = book.split(" · ")[0];
  const rows: Record<string, string>[] = [
    { startOn: text("startOn"), dueOn: text("dueOn"), topic: book, status: "planned" },
    ...StudyPlanContract.BOOK_STEPS.filter(([key]) => text(`${key}On`)).map(([key, name]) => ({ dueOn: text(`${key}On`), topic: `${name} · ${short}`, status: "planned", mockId: text(`${key}Mock`) })),
  ];
  if (!text("startOn") || !text("dueOn")) refused(path, "A book needs a start and an end date.");
  const parsed = rows.map((r) => StudyPlanContract.parseItem(r));
  const bad = parsed.find((p) => !p.ok);
  if (bad && !bad.ok) refused(path, bad.error);
  await repo.add(clientId, parsed.flatMap((p) => (p.ok ? [p.value] : [])));
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
