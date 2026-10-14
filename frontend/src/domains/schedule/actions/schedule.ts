"use server";

import { refresh, updateTag } from "next/cache";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminInbox } from "@/domains/admin/server/AdminInbox";
import { CalComClient } from "@/domains/booking/server/CalComClient";

import { BlockRepository } from "../server/BlockRepository";
import { BlockContract } from "../services/BlockContract";
import { Schedule } from "../services/Schedule";

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
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  try {
    await cal.cancelBooking(uid, reason.trim().slice(0, 300) || "Cancelled by host");
  } catch (error) {
    console.error("[schedule] cancel failed", error);
    return { ok: false, message: "Cal.com refused the cancellation. Try again or cancel from Cal.com." };
  }
  done();
  return { ok: true, message: "Booking cancelled. Cal.com has emailed the client." };
}

/** Accepts a booking waiting for confirmation. */
export async function confirmBooking(uid: string): Promise<ScheduleActionState> {
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  try {
    await cal.confirmBooking(uid);
  } catch (error) {
    console.error("[schedule] confirm failed", error);
    return { ok: false, message: "Cal.com refused the confirmation. Try again or confirm from Cal.com." };
  }
  done();
  return { ok: true, message: "Confirmed. Cal.com has emailed the client and added it to your calendar." };
}

/** Rejects a booking waiting for confirmation; the reason goes to the client. */
export async function declineBooking(uid: string, reason: string): Promise<ScheduleActionState> {
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  try {
    await cal.declineBooking(uid, reason.trim().slice(0, 300) || "This time isn't available. Please pick another.");
  } catch (error) {
    console.error("[schedule] decline failed", error);
    return { ok: false, message: "Cal.com refused. Try again or decline from Cal.com." };
  }
  done();
  return { ok: true, message: "Declined. Cal.com has emailed the client." };
}

/** Moves any booking to a new Dubai date and time (same length); Cal.com emails both sides. */
export async function moveBooking(uid: string, date: string, time: string): Promise<ScheduleActionState> {
  const cal = await bookingClient(uid);
  if (!(cal instanceof CalComClient)) return cal;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Schedule.TIME.test(time)) return { ok: false, message: "Pick a date and a time." };
  const start = Schedule.instant(date, time);
  if (Number.isNaN(Date.parse(start)) || Date.parse(start) <= Date.now()) return { ok: false, message: "Pick a time in the future." };
  const admin = await AdminAuth.require();
  try {
    await cal.rescheduleBooking(uid, start, admin.email, "Rescheduled by Finance in Practice");
  } catch (error) {
    console.error("[schedule] reschedule failed", error);
    const detail = error instanceof Error ? error.message : "";
    return { ok: false, message: `Cal.com refused the new time${detail ? `: ${detail}` : ""}. It may be outside your working hours or already taken.` };
  }
  done();
  return { ok: true, message: "Moved. Cal.com has emailed the client the new time." };
}

/** The admin is signed in and the uid looks like a Cal.com booking. */
async function bookingClient(uid: string): Promise<CalComClient | Exclude<ScheduleActionState, null>> {
  await AdminAuth.require();
  const cal = CalComClient.fromEnv();
  if (!cal) return { ok: false, message: "Cal.com is not configured." };
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(uid)) return { ok: false, message: "Unknown booking." };
  return cal;
}

function done(): void {
  updateTag(AdminInbox.BOOKINGS_TAG);
  refresh();
}
