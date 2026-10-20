import "server-only";

import { timingSafeEqual } from "node:crypto";

import { siteConfig } from "@/core/config/site";
import { EmailHtml } from "@/core/email/EmailHtml";
import { ResendClient } from "@/core/email/ResendClient";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";

import { WhatsAppText } from "../services/WhatsAppText";
import type { GatewayMessage, GatewayReport, LinkState, WhatsAppLink } from "../types";
import { WhatsAppOutbox } from "./WhatsAppOutbox";
import { WhatsAppScanner } from "./WhatsAppScanner";

const STATES: readonly LinkState[] = ["offline", "connecting", "pairing", "connected", "logged_out"];

export interface GatewayReply {
  command: { type: "link"; phone: string } | { type: "unlink" } | null;
  /** The owner's switch: false, the gateway disconnects (keeping the session) and waits. */
  on: boolean;
  messages: GatewayMessage[];
  scan: Record<string, string> | null;
}

/**
 * The website's side of the Mac gateway: one authenticated poll that records the
 * heartbeat and send results, handles STOP replies and a changed number, runs
 * the scans every few minutes, and hands over the next messages to send.
 */
export class WhatsAppGateway {
  /** Minutes between scans of Cal.com, documents and Classroom. */
  static readonly SCAN_MINUTES = 5;
  /** Not connected this long: the owner gets one email. */
  static readonly ALERT_MINUTES = 30;

  /** `Authorization: Bearer $WHATSAPP_GATEWAY_SECRET`; false when the secret isn't set. */
  static authorized(header: string | null): boolean {
    const secret = process.env.WHATSAPP_GATEWAY_SECRET?.trim();
    if (!secret || secret.length < 32) return false;
    const given = Buffer.from(header ?? "");
    const expected = Buffer.from(`Bearer ${secret}`);
    return given.length === expected.length && timingSafeEqual(given, expected);
  }

  /** The poll body, checked field by field (the gateway is trusted, but not its bugs). */
  static parse(body: unknown): GatewayReport | null {
    if (!body || typeof body !== "object") return null;
    const b = body as Record<string, unknown>;
    if (!STATES.includes(b.state as LinkState)) return null;
    const str = (v: unknown, max: number) => (typeof v === "string" && v.length <= max ? v : null);
    const results = (Array.isArray(b.results) ? b.results : []).slice(0, 50).flatMap((r) => {
      const x = r as Record<string, unknown>;
      const id = str(x?.id, 36);
      return id && typeof x.ok === "boolean" ? [{ id, ok: x.ok, error: str(x.error, 300) ?? undefined, sentTo: str(x.sentTo, 15) ?? undefined }] : [];
    });
    const inbound = (Array.isArray(b.inbound) ? b.inbound : []).slice(0, 50).flatMap((m) => {
      const x = m as Record<string, unknown>;
      const phone = str(x?.phone, 15);
      const text = str(x?.text, 200);
      return phone && /^[0-9]{8,15}$/.test(phone) && text !== null ? [{ phone, text }] : [];
    });
    return { state: b.state as LinkState, phone: str(b.phone, 15), pairingCode: str(b.pairingCode, 20), results, inbound };
  }

  static async poll(report: GatewayReport, origin: string, now = new Date()): Promise<GatewayReply> {
    const outbox = WhatsAppOutbox.fromEnv();
    if (!outbox) throw new Error("DATABASE_URL is not configured");
    const before = await outbox.heartbeat(report);
    await outbox.applyResults(report.results, before.live);
    for (const m of report.inbound) {
      const command = WhatsAppText.command(m.text);
      if (command) await outbox.optOut(m.phone, command === "stop");
    }
    if (report.state === "connected" && report.phone && before.phone && before.phone !== report.phone) {
      await WhatsAppGateway.announceNewNumber(outbox, before.live, report.phone);
    }
    let link = await outbox.link();
    await WhatsAppGateway.alertIfDown(outbox, link, now);

    let scan: Record<string, string> | null = null;
    if (report.state === "connected" && link.gatewayOn && (await outbox.claimScan(WhatsAppGateway.SCAN_MINUTES))) {
      scan = (await (await WhatsAppScanner.create(link, origin))?.run(now)) ?? null;
      link = await outbox.link();
    }
    const command: GatewayReply["command"] =
      link.command === "link" && link.commandPhone ? { type: "link", phone: link.commandPhone } : link.command === "unlink" ? { type: "unlink" } : null;
    // While a command is pending, nothing is sent from the number that is about to change.
    const messages = command ? [] : await outbox.claim(link, origin, now);
    return { command, on: link.gatewayOn, messages, scan };
  }

  /** "This is our new number" to every client introduced on the old one; by email too when live. */
  private static async announceNewNumber(outbox: WhatsAppOutbox, live: boolean, phone: string): Promise<void> {
    const { business } = await SettingsRepository.load();
    const resend = live ? ResendClient.fromEnv() : null;
    for (const c of await outbox.introduced()) {
      await outbox.enqueue(
        { dedupeKey: `number:${phone}:${c.id}`, kind: "number", clientId: c.id, phone: c.phone, body: WhatsAppText.newNumber(c.name, business.sender) },
        business.sender,
      );
      if (resend && c.email) {
        const text = `Hi ${c.name.split(/\s+/)[0]}, ${siteConfig.name} now sends WhatsApp messages from +${phone}. Please save this number; the old one is no longer used.`;
        await resend
          .send(c.email, {
            subject: `Our new WhatsApp number: +${phone}`,
            html: EmailHtml.document("New WhatsApp number", EmailHtml.paragraph(text) + EmailHtml.paragraph(`${business.sender}\n${siteConfig.name}`)),
            text: `${text}\n\n${business.sender}\n${siteConfig.name}`,
          })
          .catch((error: unknown) => console.error("[whatsapp] new-number email failed", error));
      }
    }
  }

  /**
   * One email to the owner when the number has been disconnected for a while.
   * ponytail: needs the Mac to be polling; a Mac that is off entirely only shows as "last seen" in admin (no cron, CRON_SECRET is on hold).
   */
  private static async alertIfDown(outbox: WhatsAppOutbox, link: WhatsAppLink, now: Date): Promise<void> {
    if (link.state === "connected" || !link.gatewayOn || !link.enabledAt || link.command) return;
    if (now.getTime() - link.stateSince.getTime() < WhatsAppGateway.ALERT_MINUTES * 60_000) return;
    const to = process.env.EMAIL_REPLY_TO?.trim();
    const resend = ResendClient.fromEnv();
    if (!to || !resend || !(await outbox.markAlerted())) return;
    const page = `${siteConfig.url}/admin/whatsapp`;
    const text = `WhatsApp has been "${link.state}" since ${link.stateSince.toISOString()}. Messages are waiting, not lost. Open the WhatsApp page to link the number again.`;
    await resend
      .send(to, {
        subject: "WhatsApp is disconnected",
        html: EmailHtml.document("WhatsApp is disconnected", EmailHtml.paragraph(text) + EmailHtml.button(page, "Open WhatsApp settings")),
        text: `${text}\n\n${page}`,
      })
      .catch((error: unknown) => console.error("[whatsapp] alert email failed", error));
  }
}
