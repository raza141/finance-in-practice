"use server";

import { revalidateTag } from "next/cache";
import { redirect } from "next/navigation";

import { Database } from "@/core/db/Database";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { EmailLink } from "@/domains/students/server/EmailLink";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

import { ClassroomApi } from "../server/ClassroomApi";
import { ClassroomConnection } from "../server/ClassroomConnection";
import { ClassroomSync } from "../server/ClassroomSync";
import { WeeklyDigest } from "../server/WeeklyDigest";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Owner: forget the grant here and revoke it at Google. */
export async function disconnectClassroom(): Promise<void> {
  await AdminAuth.requireOwner();
  const store = ClassroomConnection.fromEnv();
  const current = await store?.current();
  if (current?.refreshToken) await ClassroomApi.revoke(current.refreshToken);
  await store?.remove();
  revalidateTag(ClassroomSync.TAG, { expire: 0 });
  redirect("/admin/classroom?notice=disconnected");
}

/** Owner: Google "Refresh" — drop the 5-minute cache now. */
export async function refreshClassroom(): Promise<void> {
  await AdminAuth.requireOwner();
  revalidateTag(ClassroomSync.TAG, { expire: 0 });
  redirect("/admin/classroom?notice=refreshed");
}

/** Owner: the Google account a client uses in Classroom, when it isn't their portal email. Blank clears it. */
export async function saveClassroomEmail(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  if (!UUID.test(clientId)) redirect("/admin/clients");
  const email = String(formData.get("classroomEmail") ?? "").trim().toLowerCase();
  const path = `/admin/clients/${clientId}`;
  if (email && (email.length > 254 || !EMAIL.test(email))) redirect(`${path}?notice=classroom-email-invalid#classroom`);
  const sql = Database.sql();
  if (sql) await sql`UPDATE clients SET classroom_email = ${email || null}, updated_at = now() WHERE id = ${clientId}`;
  redirect(`${path}?notice=classroom-email-saved#classroom`);
}

/** Student opened the Classroom tab: items posted before now stop showing "New" next time. */
export async function markFeedSeen(): Promise<void> {
  const student = await StudentAuth.current();
  const sql = Database.sql();
  if (student && sql) await sql`UPDATE clients SET feed_seen_at = now() WHERE id = ${student.id}`;
}

/** From the weekly email's link (signed, unsubscribe only): no sign-in needed. */
export async function stopWeeklyEmail(formData: FormData): Promise<void> {
  const link = EmailLink.fromEnv()?.read(String(formData.get("t") ?? ""));
  if (link?.kind === "unsubscribe") await WeeklyDigest.switchOff(link.id);
  // Same answer for a bad link: it reveals nothing and changes nothing.
  redirect("/student/weekly-email?done=1");
}

/** Owner: email myself what this client's Sunday email would say right now. */
export async function previewWeeklyEmail(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  if (!UUID.test(clientId)) redirect("/admin/clients");
  let outcome: string;
  try {
    outcome = await WeeklyDigest.preview(clientId);
  } catch (error) {
    console.error("[weekly-digest] preview failed", error);
    outcome = "failed";
  }
  redirect(`/admin/clients/${clientId}?notice=digest-${outcome}#classroom`);
}
