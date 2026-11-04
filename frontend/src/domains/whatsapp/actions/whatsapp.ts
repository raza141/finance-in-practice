"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

import { WhatsAppClassPosts } from "../server/WhatsAppClassPosts";
import { WhatsAppOutbox } from "../server/WhatsAppOutbox";
import { WhatsAppScanner } from "../server/WhatsAppScanner";
import { WhatsAppText } from "../services/WhatsAppText";

/** Owner actions on the WhatsApp page. Each re-checks the session: server actions are public POST endpoints. */

const PAGE = "/admin/whatsapp";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Most students one send may reach. */
const MAX_RECIPIENTS = 300;

/** Back to the WhatsApp page on a tab (`tab=connection`) or a message type (`type=mock`), with a notice. */
function back(where: string, notice: string, n?: number): never {
  redirect(`${PAGE}?${where}&notice=${notice}${n === undefined ? "" : `&n=${n}`}`);
}

/** Owner's sign-off from Settings. */
async function signature() {
  const { business } = await SettingsRepository.load();
  return { sender: business.sender, business: business.name };
}

/** The ticked students (each id once), or none when more than one send may reach. */
function chosenIds(formData: FormData): string[] {
  const ids = [...new Set(formData.getAll("clientId").map(String))].filter((id) => UUID.test(id));
  return ids.length <= MAX_RECIPIENTS ? ids : [];
}

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
  redirect(`${PAGE}?tab=connection`);
}

export async function unlinkNumber(): Promise<void> {
  await (await owner()).requestUnlink();
  back("tab=connection", "unlinking");
}

/** The On/Off switch: the gateway on the Mac obeys it at its next poll (within a minute). */
export async function setGatewayOn(formData: FormData): Promise<void> {
  const on = formData.get("on") === "1";
  await (await owner()).setGatewayOn(on);
  back("tab=connection", on ? "switched-on" : "switched-off");
}

/** Test mode sends everything to the owner's number; live sends to students. */
export async function setMode(formData: FormData): Promise<void> {
  const outbox = await owner();
  const live = formData.get("mode") === "live";
  const testPhone = WhatsAppText.phone(String(formData.get("testPhone") ?? "")) || null;
  if (!live && !testPhone) back("tab=connection", "bad-phone");
  await outbox.setMode(live, testPhone);
  back("tab=connection", live ? "live" : "test");
}

export async function retryMessage(formData: FormData): Promise<void> {
  await (await owner()).retry(String(formData.get("id")));
  back("tab=outbox", "retried");
}

/** A message that already went out (or was cancelled), once more. */
export async function resendMessage(formData: FormData): Promise<void> {
  await (await owner()).resend(String(formData.get("id")));
  back("tab=outbox", "resent");
}

/**
 * The owner's own message to one or more students; {firstName} becomes each one's first name. Goes out in
 * quiet hours too (the owner chose to send it now). `batch` is rendered into the form, so a double click or a
 * re-sent POST queues nothing new. `back`: a client page to return to.
 */
export async function sendOwnMessage(formData: FormData): Promise<void> {
  const outbox = await owner();
  const text = String(formData.get("message") ?? "").trim().slice(0, 3000);
  const chosen = new Set(chosenIds(formData));
  const batch = String(formData.get("batch") ?? "");
  const from = String(formData.get("back") ?? "");
  const done = (notice: string, n?: number) =>
    /^\/admin\/clients\/[0-9a-f-]{36}$/i.test(from) ? redirect(`${from}?notice=${notice}${n === undefined ? "" : `&n=${n}`}#compose`) : back("type=custom", notice, n);
  if (!text || chosen.size === 0 || !UUID.test(batch)) done("nobody");
  const sign = await signature();
  // A starter sent as it is would greet and sign off with nothing in between.
  if (WhatsAppText.starters(sign).some((st) => st.text.trim() === text)) done("unedited");
  const { sender } = sign;
  let queued = 0;
  for (const c of (await outbox.reachable()).filter((r) => chosen.has(r.id))) {
    const ok = await outbox.enqueue(
      { dedupeKey: `manual:${batch}:${c.id}`, kind: "manual", clientId: c.id, phone: c.phone, body: WhatsAppText.personal(text, c.name), quietOk: true },
      sender,
    );
    if (ok) queued++;
  }
  done("own-sent", queued);
}

/** A published mock announced by hand ("you now have access to …"), only to the ticked students who can open it. */
export async function sendMockMessage(formData: FormData): Promise<void> {
  const outbox = await owner();
  const mockId = String(formData.get("mockId") ?? "");
  const batch = String(formData.get("batch") ?? "");
  const chosen = chosenIds(formData);
  const mocks = MockRepository.fromEnv();
  const exam = UUID.test(mockId) && mocks ? await mocks.byId(mockId) : null;
  if (!exam?.published || chosen.length === 0 || !UUID.test(batch)) back("type=mock", "nobody");
  const open = new Set(await mocks!.openClients(mockId));
  const queued = await outbox.mockGiven(chosen.filter((id) => open.has(id)), exam.title, null, `manual:${batch}:${mockId}`, true);
  back("type=mock", "mock-sent", queued);
}

/** A session's confirmation or reminder again, now, to one of its students. */
export async function sendBookingMessage(formData: FormData): Promise<void> {
  const outbox = await owner();
  const which = formData.get("which") === "reminder" ? "reminder" : "confirmed";
  const scanner = await WhatsAppScanner.create(await outbox.link(), await origin());
  if (!scanner) back(`type=${which === "reminder" ? "reminder" : "booking"}`, "not-linked");
  const ok = await scanner.sendBooking(String(formData.get("uid") ?? ""), String(formData.get("clientId") ?? ""), which).catch(() => false);
  back(`type=${which === "reminder" ? "reminder" : "booking"}`, ok ? "sent-one" : "not-sent");
}

/** An issued invoice or receipt on WhatsApp again, with its PDF. */
export async function sendDocumentMessage(formData: FormData): Promise<void> {
  const outbox = await owner();
  const scanner = await WhatsAppScanner.create(await outbox.link(), await origin());
  if (!scanner) back("type=invoice", "not-linked");
  const id = String(formData.get("id") ?? "");
  const ok = UUID.test(id) && (await scanner.document(id, String(Date.now())));
  back("type=invoice", ok ? "sent-one" : "not-sent");
}

/** Which message-type tab a wording field lives on. */
const WORDING_TAB: Record<string, string> = { "wa.booking": "booking", "wa.reminder": "reminder", "wa.overdue": "overdue", "wa.mock": "mock", "wa.class": "classroom" };

/** Saves (or resets to the default) one automatic message's wording. The field name is checked against the known ones. */
export async function saveWhatsAppText(formData: FormData): Promise<void> {
  const admin = await AdminAuth.requireOwner();
  const repo = SettingsRepository.fromEnv();
  if (!repo) throw new Error("DATABASE_URL is not configured");
  const field = String(formData.get("field") ?? "");
  const tab = `type=${WORDING_TAB[field] ?? "invoice"}`;
  const reset = formData.get("intent") === "reset";
  const text = reset ? SettingsContract.whatsappDefault(field) : String(formData.get("text") ?? "").trim();
  if (!text || text.length > SettingsContract.LIMITS.message) back(tab, "bad-text");
  const next = SettingsContract.withWhatsAppText(await repo.get(), field, text);
  if (!next) back(tab, "bad-text");
  await repo.save(next, admin.id);
  back(tab, reset ? "reset" : "saved");
}

export async function cancelMessage(formData: FormData): Promise<void> {
  await (await owner()).cancel(String(formData.get("id")));
  back("tab=outbox", "cancelled");
}

export async function sendClassPost(formData: FormData): Promise<void> {
  await owner();
  const posts = WhatsAppClassPosts.fromEnv();
  const itemId = String(formData.get("itemId") ?? "");
  const template = String(formData.get("message") ?? "").trim().slice(0, 3000);
  const chosen = chosenIds(formData);
  if (!posts || !template || chosen.length === 0) back("type=classroom", "nobody");
  const { sender } = await signature();
  const queued = await posts.send(itemId, chosen, template, sender);
  back("type=classroom", "class-sent", queued);
}

export async function dismissClassPost(formData: FormData): Promise<void> {
  await owner();
  await WhatsAppClassPosts.fromEnv()?.dismiss(String(formData.get("itemId") ?? ""));
  back("type=classroom", "dismissed");
}

export async function nudgeClassPost(formData: FormData): Promise<void> {
  await owner();
  const posts = WhatsAppClassPosts.fromEnv();
  const today = new ZonedCalendar(WhatsAppText.ZONE).today();
  const queued = (await posts?.nudge(String(formData.get("itemId") ?? ""), await signature(), today)) ?? 0;
  back("type=classroom", "nudged", queued);
}

/** Another overdue reminder for one invoice (the automatic one goes once, 5 days after the due date). */
export async function remindInvoice(formData: FormData): Promise<void> {
  const outbox = await owner();
  const scanner = await WhatsAppScanner.create(await outbox.link(), await origin());
  if (!scanner) back("type=overdue", "not-linked");
  const ok = await scanner.remind(String(formData.get("id") ?? ""), String(Date.now()));
  back("type=overdue", ok ? "reminded" : "not-reminded");
}
