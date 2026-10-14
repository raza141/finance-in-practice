"use server";

import { redirect } from "next/navigation";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
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

/** Best-effort "you're in" email; approval stands even if it fails. */
async function welcome(student: { name: string; email: string }, course: string): Promise<void> {
  const resend = ResendClient.fromEnv();
  if (!resend) return;
  const first = student.name.split(/\s+/)[0];
  const portal = `${siteConfig.url}${siteConfig.studentBooking.href}`;
  try {
    await resend.send(student.email, {
      subject: "You're in: your Finance in Practice student portal",
      html: EmailHtml.document(
        "Welcome to Finance in Practice",
        EmailHtml.paragraph(`Hi ${first},`) +
          EmailHtml.paragraph(`Your place on ${course} is confirmed. Sign in with this Google account to book sessions, see your study plan and open your materials.`) +
          EmailHtml.button(portal, "Open the student portal"),
      ),
      text: `Hi ${first},\n\nYour place on ${course} is confirmed. Sign in with this Google account at ${portal} to book sessions and see your study plan.`,
    });
  } catch (error) {
    console.error("[registrations] welcome email failed", error);
  }
}

/** Gives the student a catalogue course (draft or published): they can sign in at /student from now on. */
export async function approveRegistration(formData: FormData): Promise<void> {
  const repo = await registrations();
  const course = String(formData.get("course") ?? "");
  const titles = ((await CourseRepository.fromEnv()?.all()) ?? []).map((c) => c.title);
  if (!titles.includes(course)) redirect("/admin/clients?notice=registration-refused#registrations");
  const approved = await repo.approve(String(formData.get("id")), course);
  if (!approved) redirect("/admin/clients?notice=registration-refused#registrations");
  await welcome(approved, course);
  redirect(`/admin/clients/${approved.clientId}`);
}

export async function dismissRegistration(formData: FormData): Promise<void> {
  const repo = await registrations();
  await repo.remove(String(formData.get("id")));
  redirect("/admin/clients#registrations");
}
