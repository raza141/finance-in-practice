"use server";

import { refresh, revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { PackageRepository } from "@/domains/packages/server/PackageRepository";

import { CourseMoveRepository } from "../server/CourseMoveRepository";
import { OwnerNotice } from "../server/OwnerNotice";
import { StudentAuth } from "../server/StudentAuth";
import { NextSteps } from "../services/NextSteps";

function moves(): CourseMoveRepository {
  const repo = CourseMoveRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

/** The student reports how a sitting went; only for a sitting of theirs that has ended. */
export async function reportResult(formData: FormData): Promise<void> {
  const student = await StudentAuth.current();
  if (!student) return;
  const course = String(formData.get("course") ?? "");
  const label = String(formData.get("label") ?? "");
  if (!student.ended.some((e) => !e.paused && e.course === course && e.label === label)) return;
  const repo = moves();
  if (formData.get("answer") === "undo") await repo.unreport(student.id, course, label);
  else await repo.report(student.id, course, label, formData.get("answer") === "passed");
  refresh();
}

/** Next level, retake or another course: a request the owner approves. Only what the portal offered them. */
export async function requestCourse(formData: FormData): Promise<void> {
  const student = await StudentAuth.current();
  if (!student) return;
  const ask = { course: String(formData.get("course") ?? ""), label: String(formData.get("label") ?? ""), retake: formData.get("retake") === "1" };
  const repo = moves();
  if (!NextSteps.allowed(await repo.input(student), ask)) return;
  if (await repo.request(student.id, ask)) {
    await OwnerNotice.send(
      `${ask.retake ? "Retake" : "Course"} request: ${student.name} · ${ask.course}`,
      ask.retake ? "Retake request" : "Course request",
      [
        ["Student", student.name],
        ["Email", student.email],
        ["Course", ask.label ? `${ask.course} · ${ask.label}` : ask.course],
        ...(ask.retake ? ([["Price", `Retake: ${NextSteps.RETAKE_DISCOUNT}% off the package`]] as [string, string][]) : []),
      ],
      student.id,
    );
  }
  refresh();
}

/** Owner opens the asked course; a package, when picked, starts with it (a retake's at the discount unless a price is typed). */
export async function approveCourseRequest(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const repo = moves();
  const id = String(formData.get("requestId") ?? "");
  const clientId = String(formData.get("clientId") ?? "");
  const course = String(formData.get("course") ?? "");
  const retake = formData.get("retake") === "1";
  // A retake pauses the level above it (CFA won't seat Level II before Level I is passed).
  const ticker = retake ? await repo.tickerOf(course) : null;
  const above = ticker && NextSteps.NEXT[ticker] ? await repo.titleFor(NextSteps.NEXT[ticker]) : null;
  const req = await repo.approve(id, above);
  if (!req) redirect(`/admin/clients/${clientId}?notice=course-refused`);
  const packageId = String(formData.get("packageId") ?? "");
  const packages = PackageRepository.fromEnv();
  if (packageId && packages) {
    const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
    const raw = String(formData.get("startsOn") ?? "");
    const startsOn = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : today;
    const typed = InvoiceMath.parseMajor(String(formData.get("price") ?? ""));
    const listed = (await packages.byId(packageId))?.priceMinor ?? null;
    const priceMinor = typed || (req.retake && listed ? NextSteps.retakePrice(listed) : null);
    await packages.assign(req.clientId, packageId, startsOn, { priceMinor });
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/clients/${req.clientId}?notice=course-approved`);
}

export async function declineCourseRequest(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = await moves().decline(String(formData.get("requestId") ?? ""));
  revalidatePath("/admin", "layout");
  redirect(clientId ? `/admin/clients/${clientId}?notice=course-declined` : "/admin/clients");
}
