"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { ClassroomRepository } from "../server/ClassroomRepository";
import { ClassroomLink } from "../services/ClassroomLink";

/** Saves (or clears, when blank) a course's Google Classroom invite. Owner only: the link lets anyone join the class. */
export async function saveClassroomLink(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const repo = ClassroomRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  const courseId = String(formData.get("courseId"));
  const url = String(formData.get("classroomUrl") ?? "").trim();
  const path = `/admin/courses/${courseId}`;
  if (url && !ClassroomLink.isValid(url)) redirect(`${path}?classroom=invalid#classroom`);
  await repo.save(courseId, url || null);
  redirect(`${path}?classroom=saved#classroom`);
}
