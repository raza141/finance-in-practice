"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

import { WhatsAppClassPosts } from "../server/WhatsAppClassPosts";
import { WhatsAppOutbox } from "../server/WhatsAppOutbox";
import { WhatsAppScanner } from "../server/WhatsAppScanner";
import { WhatsAppText } from "../services/WhatsAppText";

/** Owner actions on the WhatsApp page. Each re-checks the session: server actions are public POST endpoints. */

const PAGE = "/admin/whatsapp";

async function owner(): Promise<WhatsAppOutbox> {
  await AdminAuth.requireOwner();
  const outbox = WhatsAppOutbox.fromEnv();
  if (!outbox) throw new Error("DATABASE_URL is not configured");
  return outbox;
}

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Link (or switch to) a number: the gateway shows a QR code on the page for about 3 minutes. */
export async function linkNumber(): Promise<void> {
  await (await owner()).requestLink();
  redirect(PAGE);
}

export async function unlinkNumber(): Promise<void> {
  await (await owner()).requestUnlink();
  redirect(`${PAGE}?notice=unlinking`);
}

/** The On/Off switch: the gateway on the Mac obeys it at its next poll (within a minute). */
export async function setGatewayOn(formData: FormData): Promise<void> {
  const on = formData.get("on") === "1";
  await (await owner()).setGatewayOn(on);
  redirect(`${PAGE}?notice=${on ? "switched-on" : "switched-off"}`);
}

/** Test mode sends everything to the owner's number; live sends to students. */
export async function setMode(formData: FormData): Promise<void> {
  const outbox = await owner();
  const live = formData.get("mode") === "live";
  const testPhone = WhatsAppText.phone(String(formData.get("testPhone") ?? "")) || null;
  if (!live && !testPhone) redirect(`${PAGE}?notice=bad-phone`);
  await outbox.setMode(live, testPhone);
  redirect(`${PAGE}?notice=${live ? "live" : "test"}`);
}

export async function retryMessage(formData: FormData): Promise<void> {
  await (await owner()).retry(String(formData.get("id")));
  redirect(`${PAGE}?notice=retried#outbox`);
}

export async function cancelMessage(formData: FormData): Promise<void> {
  await (await owner()).cancel(String(formData.get("id")));
  redirect(`${PAGE}?notice=cancelled#outbox`);
}

export async function sendClassPost(formData: FormData): Promise<void> {
  await owner();
  const posts = WhatsAppClassPosts.fromEnv();
  const itemId = String(formData.get("itemId") ?? "");
  const template = String(formData.get("message") ?? "").trim().slice(0, 3000);
  const chosen = formData.getAll("clientId").map(String);
  if (!posts || !template || chosen.length === 0) redirect(`${PAGE}?notice=nobody#posts`);
  const { business } = await SettingsRepository.load();
  const queued = await posts.send(itemId, chosen, template, business.sender);
  redirect(`${PAGE}?notice=class-sent&n=${queued}#posts`);
}

export async function dismissClassPost(formData: FormData): Promise<void> {
  await owner();
  await WhatsAppClassPosts.fromEnv()?.dismiss(String(formData.get("itemId") ?? ""));
  redirect(`${PAGE}?notice=dismissed#posts`);
}

export async function nudgeClassPost(formData: FormData): Promise<void> {
  await owner();
  const posts = WhatsAppClassPosts.fromEnv();
  const { business } = await SettingsRepository.load();
  const today = new ZonedCalendar(WhatsAppText.ZONE).today();
  const queued = (await posts?.nudge(String(formData.get("itemId") ?? ""), business.sender, today)) ?? 0;
  redirect(`${PAGE}?notice=nudged&n=${queued}#nudges`);
}

/** Another overdue reminder for one invoice (the automatic one goes once, 5 days after the due date). */
export async function remindInvoice(formData: FormData): Promise<void> {
  const outbox = await owner();
  const scanner = await WhatsAppScanner.create(await outbox.link(), await origin());
  if (!scanner) redirect(`${PAGE}?notice=not-linked#overdue`);
  const ok = await scanner.remind(String(formData.get("id") ?? ""), String(Date.now()));
  redirect(`${PAGE}?notice=${ok ? "reminded" : "not-reminded"}#overdue`);
}
