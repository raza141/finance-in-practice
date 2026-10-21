"use server";

import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";

import { SessionLogRepository } from "../server/SessionLogRepository";
import { SessionLogContract } from "../services/SessionLogContract";

/** Admin edits to the hours a student actually studied (shown in their Hours & payments tab). Each action re-checks the owner session. */

async function log(formData: FormData): Promise<{ repo: SessionLogRepository; clientId: string; path: string }> {
  await AdminAuth.requireOwner();
  const repo = SessionLogRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  const clientId = String(formData.get("clientId"));
  return { repo, clientId, path: `/admin/clients/${clientId}` };
}

export async function saveSessionLog(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await log(formData);
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const parsed = SessionLogContract.parse(Object.fromEntries(formData), today);
  if (!parsed.ok) redirect(`${path}?notice=hours-refused&reason=${encodeURIComponent(parsed.error)}#sessions`);
  await repo.save(clientId, parsed.value);
  redirect(`${path}?notice=hours-saved#sessions`);
}

export async function removeSessionLog(formData: FormData): Promise<void> {
  const { repo, clientId, path } = await log(formData);
  await repo.remove(clientId, String(formData.get("logId")));
  redirect(`${path}?notice=hours-saved#sessions`);
}
