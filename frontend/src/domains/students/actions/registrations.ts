"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";

import { RegistrationRepository } from "../server/RegistrationRepository";

/** Owner decisions on public sign-ups. Each action re-checks the owner session. */

async function registrations(): Promise<RegistrationRepository> {
  await AdminAuth.requireOwner();
  const repo = RegistrationRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** Gives the student a catalogue course (draft or published): they can sign in at /student from now on. */
export async function approveRegistration(formData: FormData): Promise<void> {
  const repo = await registrations();
  const course = String(formData.get("course") ?? "");
  const titles = ((await CourseRepository.fromEnv()?.all()) ?? []).map((c) => c.title);
  if (!titles.includes(course)) redirect("/admin/clients?notice=registration-refused#registrations");
  const clientId = await repo.approve(String(formData.get("id")), course);
  redirect(clientId ? `/admin/clients/${clientId}` : "/admin/clients?notice=registration-refused#registrations");
}

export async function dismissRegistration(formData: FormData): Promise<void> {
  const repo = await registrations();
  await repo.remove(String(formData.get("id")));
  redirect("/admin/clients#registrations");
}
