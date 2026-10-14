"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { ClassroomRepository } from "../server/ClassroomRepository";
import { OwnerNotice } from "../server/OwnerNotice";
import { StudentAuth } from "../server/StudentAuth";
import { ClassroomLink } from "../services/ClassroomLink";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function classrooms(): ClassroomRepository {
  const repo = ClassroomRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** Saves (or clears, when blank) a course's Google Classroom invite. Owner only: the link lets anyone join the class. */
export async function saveClassroomLink(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const courseId = String(formData.get("courseId"));
  const url = String(formData.get("classroomUrl") ?? "").trim();
  const path = `/admin/courses/${courseId}`;
  if (url && !ClassroomLink.isValid(url)) redirect(`${path}?classroom=invalid#classroom`);
  await classrooms().save(courseId, url || null);
  redirect(`${path}?classroom=saved#classroom`);
}

/** A signed-in student asks to join one of their courses' Classroom; the owner gets an email. */
export async function requestClassroom(course: string): Promise<void> {
  const student = await StudentAuth.current();
  if (!student) return;
  const repo = classrooms();
  // Only their own course, and only one that has a Classroom.
  const target = (await repo.forClient(student.id, student.courses)).find((c) => c.title === course);
  if (!target || target.access !== "none") return;
  if (await repo.request(student.id, target.title)) {
    await OwnerNotice.send(
      `Classroom request: ${student.name} · ${target.title}`,
      "Classroom access request",
      [
        ["Student", student.name],
        ["Email", student.email],
        ["Course", target.title],
      ],
      student.id,
    );
  }
  refresh();
}

/** Owner approves or removes a client's access to a course's Classroom invite. */
export async function decideClassroom(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  if (!UUID.test(clientId)) redirect("/admin/clients");
  const course = String(formData.get("course") ?? "");
  const status = formData.get("status") === "approved" ? "approved" : "removed";
  await classrooms().decide(clientId, course, status);
  // Re-render the admin layout too, so the Clients badge drops at once.
  revalidatePath("/admin", "layout");
  redirect(`/admin/clients/${clientId}?notice=classroom-${status}#classroom`);
}
