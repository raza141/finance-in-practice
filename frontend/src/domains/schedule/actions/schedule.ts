"use server";

import { refresh } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CalComClient } from "@/domains/booking/server/CalComClient";

import { BlockRepository } from "../server/BlockRepository";
import { BlockContract } from "../services/BlockContract";

/** Schedule management. Server actions are public POST endpoints: each re-checks the session. */

export type ScheduleActionState = { ok: boolean; message: string } | null;

function blocks(): BlockRepository {
  const repo = BlockRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  return repo;
}

export async function blockTime(_prev: ScheduleActionState, form: FormData): Promise<ScheduleActionState> {
  const admin = await AdminAuth.require();
  const input = BlockContract.parse(form);
  if (!input.ok) return input;
  await blocks().create(input.range, input.reason, admin.id);
  refresh();
  return { ok: true, message: "Blocked. Those slots are hidden from the website now." };
}

export async function removeBlock(id: string): Promise<void> {
  await AdminAuth.require();
  await blocks().remove(id);
  refresh();
}

/** Cal.com emails the client and removes the event from the connected calendars. */
export async function cancelBooking(uid: string, reason: string): Promise<ScheduleActionState> {
  await AdminAuth.require();
  const cal = CalComClient.fromEnv();
  if (!cal) return { ok: false, message: "Cal.com is not configured." };
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(uid)) return { ok: false, message: "Unknown booking." };
  try {
    await cal.cancelBooking(uid, reason.trim().slice(0, 300) || "Cancelled by host");
  } catch (error) {
    console.error("[schedule] cancel failed", error);
    return { ok: false, message: "Cal.com refused the cancellation. Try again or cancel from Cal.com." };
  }
  refresh();
  return { ok: true, message: "Booking cancelled. Cal.com has emailed the client." };
}
