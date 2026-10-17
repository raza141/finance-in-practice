"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ClassroomSync } from "@/domains/classroom/server/ClassroomSync";

import { ClassroomRepository } from "../server/ClassroomRepository";
import { OwnerNotice } from "../server/OwnerNotice";
import { StudentAuth } from "../server/StudentAuth";
import { Batches } from "../services/Batches";
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
  if (!target || !target.hasClass || target.access !== "none") return;
  if (await repo.request(student.id, target.title)) {
    await OwnerNotice.send(
      `Classroom request: ${student.name} · ${target.title}`,
      "Classroom access request",
      [
        ["Student", student.name],
        ["Email", student.email],
        ["Course", target.batch ? `${target.title} · ${target.batch}` : target.title],
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
  const repo = classrooms();
  if (status === "approved") {
    // One Google class, one card: refuse when a private class of theirs is the same class.
    const links = await repo.linksFor(clientId);
    const own = links.find((l) => l.kind === "course" && l.title === course);
    const clash = own && (await ClassroomSync.sameClass(own.url, links.filter((l) => l.kind === "private")));
    if (clash) redirect(`/admin/clients/${clientId}?notice=classroom-duplicate&reason=${encodeURIComponent(`Remove the private "${clash.title}" first.`)}#classroom`);
  }
  await repo.decide(clientId, course, status);
  // Re-render the admin layout too, so the Clients badge drops at once.
  revalidatePath("/admin", "layout");
  redirect(`/admin/clients/${clientId}?notice=classroom-${status}#classroom`);
}

/** Owner adds a class just for this client: it shows in their portal straight away. */
export async function addPrivateClassroom(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  if (!UUID.test(clientId)) redirect("/admin/clients");
  const clean = (key: string) => String(formData.get(key) ?? "").trim().replace(/\s+/g, " ");
  const title = clean("title");
  const note = clean("note");
  const url = clean("url");
  const path = `/admin/clients/${clientId}`;
  if (!title || title.length > 120 || note.length > 160 || !ClassroomLink.isValid(url)) {
    redirect(`${path}?notice=private-refused#classroom`);
  }
  const repo = classrooms();
  // One Google class, one card: refuse a class they already get through a course or another private class.
  const clash = await ClassroomSync.sameClass(url, await repo.linksFor(clientId));
  if (clash) {
    const where = clash.kind === "course" ? `the ${clash.title} course (approve it under Course classrooms)` : `the private "${clash.title}"`;
    redirect(`${path}?notice=private-duplicate&reason=${encodeURIComponent(`It's ${where}.`)}#classroom`);
  }
  await repo.addPrivate(clientId, { title, note, url });
  redirect(`${path}?notice=private-added#classroom`);
}

export async function removePrivateClassroom(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  if (!UUID.test(clientId)) redirect("/admin/clients");
  await classrooms().removePrivate(clientId, String(formData.get("id")));
  redirect(`/admin/clients/${clientId}?notice=private-removed#classroom`);
}

/** Owner puts a client in a batch (or "Not sure yet") for one of their exam courses. */
export async function setClientBatch(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  if (!UUID.test(clientId)) redirect("/admin/clients");
  const course = String(formData.get("course") ?? "");
  const label = String(formData.get("batch") ?? "");
  const repo = classrooms();
  const allowed = (await repo.batchCourses()).find((c) => c.title === course)?.assignable ?? [];
  if (label !== Batches.NOT_SURE && !allowed.includes(label)) redirect(`/admin/clients/${clientId}?notice=batch-refused#classroom`);
  const { moved } = await repo.setBatch(clientId, course, label);
  revalidatePath("/admin", "layout");
  redirect(`/admin/clients/${clientId}?notice=${moved ? "batch-moved" : "batch-saved"}#classroom`);
}

const BATCHES = "/admin/classroom";

/** Owner opens a batch for an exam course and sitting, with its Google class link (or later). */
export async function openBatch(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const course = String(formData.get("course") ?? "");
  const label = String(formData.get("label") ?? "");
  const url = String(formData.get("url") ?? "").trim();
  const repo = classrooms();
  const sitting = (await repo.batchCourses()).find((c) => c.title === course)?.windows.find((w) => w.label === label);
  if (!sitting || (url && !ClassroomLink.isValid(url))) redirect(`${BATCHES}?batch=refused#batches`);
  if (url) await refuseTaken(repo, url, null);
  if (!(await repo.openBatch(course, label, sitting.starts, url || null))) redirect(`${BATCHES}?batch=exists#batches`);
  redirect(`${BATCHES}?batch=opened#batches`);
}

/** Owner sets (or clears) a batch's Google class link. */
export async function saveBatchLink(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const id = String(formData.get("id"));
  const url = String(formData.get("url") ?? "").trim();
  if (url && !ClassroomLink.isValid(url)) redirect(`${BATCHES}?batch=refused#batches`);
  const repo = classrooms();
  if (url) await refuseTaken(repo, url, id);
  await repo.saveBatchLink(id, url || null);
  redirect(`${BATCHES}?batch=saved#batches`);
}

export async function deleteBatch(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const removed = await classrooms().deleteBatch(String(formData.get("id")));
  redirect(`${BATCHES}?batch=${removed ? "deleted" : "in-use"}#batches`);
}

/** One Google class, one place: refuse a batch link already used by another batch, a course or a private classroom. */
async function refuseTaken(repo: ClassroomRepository, url: string, batchId: string | null): Promise<void> {
  const own = batchId ? (await repo.batches()).find((b) => b.id === batchId) : undefined;
  const others = (await repo.allLinks()).filter((l) => !own || l.title !== `${own.course} · ${own.label}`);
  const clash = await ClassroomSync.sameClass(url, others);
  if (clash) redirect(`${BATCHES}?batch=taken&reason=${encodeURIComponent(`It's already used by ${clash.title}.`)}#batches`);
}
