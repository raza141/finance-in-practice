import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import { WhatsAppText } from "../services/WhatsAppText";
import type { GatewayMessage, GatewayReport, MessageRow, OutgoingMessage, WhatsAppLink } from "../types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type LinkRow = {
  state: WhatsAppLink["state"];
  state_since: Date;
  phone: string | null;
  command: WhatsAppLink["command"];
  pairing_qr: string | null;
  test_phone: string | null;
  live: boolean;
  gateway_on: boolean;
  enabled_at: Date | null;
  last_seen_at: Date | null;
  last_scan_at: Date | null;
  seen_minutes: number | null;
};

/**
 * The WhatsApp outbox (044_whatsapp) and the gateway's link state. Queuing is
 * idempotent (dedupe_key), so scanning the same booking twice queues one message.
 * A message is claimed once: a claim with no result is marked "unknown", never resent.
 */
export class WhatsAppOutbox {
  /** Messages handed to the gateway per poll. */
  static readonly BATCH = 5;
  /** A claim older than this with no result: the gateway died mid-send. */
  static readonly CLAIM_MINUTES = 10;

  constructor(private readonly sql: Sql) {}

  static fromEnv(): WhatsAppOutbox | null {
    const sql = Database.sql();
    return sql ? new WhatsAppOutbox(sql) : null;
  }

  async link(): Promise<WhatsAppLink> {
    const [row] = (await this.sql`SELECT *, floor(extract(epoch FROM now() - last_seen_at) / 60)::int AS seen_minutes FROM whatsapp_link WHERE id = 1`) as LinkRow[];
    return {
      state: row.state,
      stateSince: row.state_since,
      phone: row.phone,
      command: row.command,
      pairingQr: row.pairing_qr,
      testPhone: row.test_phone,
      live: row.live,
      gatewayOn: row.gateway_on,
      enabledAt: row.enabled_at,
      lastSeenAt: row.last_seen_at,
      lastScanAt: row.last_scan_at,
      seenMinutes: row.seen_minutes,
    };
  }

  /**
   * Queues a message, plus the client's "save this number" intro first when this
   * phone hasn't had one. Nothing for a client who replied STOP or has no usable
   * number. Returns false when nothing was queued.
   */
  async enqueue(message: OutgoingMessage, sender: string): Promise<boolean> {
    const phone = WhatsAppText.phone(message.phone);
    if (!phone || !UUID.test(message.clientId)) return false;
    const [client] = (await this.sql`
      SELECT name, whatsapp_intro_phone, whatsapp_off FROM clients WHERE id = ${message.clientId}
    `) as { name: string; whatsapp_intro_phone: string | null; whatsapp_off: boolean }[];
    if (!client || client.whatsapp_off) return false;
    if (client.whatsapp_intro_phone !== phone && message.kind !== "intro" && message.kind !== "number") {
      await this.insert(
        { dedupeKey: `intro:${message.clientId}:${phone}`, kind: "intro", clientId: message.clientId, phone, body: WhatsAppText.intro(client.name, sender) },
        true,
      );
    }
    return this.insert({ ...message, phone });
  }

  /** `requeue`: an intro that expired or was cancelled is queued again, or the client's messages would wait on it forever. */
  private async insert(m: OutgoingMessage, requeue = false): Promise<boolean> {
    const rows = await this.sql`
      INSERT INTO whatsapp_messages (dedupe_key, kind, client_id, phone, body, ref, document_token, attachment_name, not_before, expires_at, quiet_ok)
      VALUES (${m.dedupeKey}, ${m.kind}, ${m.clientId}, ${m.phone}, ${m.body.slice(0, 4000)}, ${m.ref ?? null}, ${m.documentToken ?? null},
              ${m.attachmentName?.slice(0, 160) ?? null}, ${m.notBefore ?? new Date()}, ${m.expiresAt ?? null}, ${m.quietOk ?? false})
      ON CONFLICT (dedupe_key) DO UPDATE SET status = 'queued', error = NULL, created_at = now(), not_before = now(), expires_at = NULL, claimed_at = NULL
        WHERE ${requeue} AND whatsapp_messages.status IN ('expired', 'cancelled')
      RETURNING id
    `;
    return rows.length > 0;
  }

  /** Is this event's message already queued (or sent)? */
  async has(dedupeKey: string): Promise<boolean> {
    return ((await this.sql`SELECT 1 FROM whatsapp_messages WHERE dedupe_key = ${dedupeKey}`) as unknown[]).length > 0;
  }

  /** Queued messages about something that no longer happens (a cancelled booking). */
  async cancelFor(ref: string): Promise<void> {
    await this.sql`UPDATE whatsapp_messages SET status = 'cancelled' WHERE ref = ${ref} AND status = 'queued'`;
  }

  /** A moved booking: queued messages for its old time are dropped (keys carry the start time). */
  async cancelOtherTimes(ref: string, currentPrefix: string): Promise<void> {
    await this.sql`
      UPDATE whatsapp_messages SET status = 'cancelled'
      WHERE ref = ${ref} AND status = 'queued' AND left(dedupe_key, ${currentPrefix.length}) <> ${currentPrefix}
    `;
  }

  /** Records the gateway's heartbeat and what it reports. Returns the state as it was before. */
  async heartbeat(report: GatewayReport): Promise<WhatsAppLink> {
    const before = await this.link();
    const phone = report.state === "connected" && report.phone && /^[0-9]{8,15}$/.test(report.phone) ? report.phone : null;
    await this.sql`
      UPDATE whatsapp_link SET
        state = ${report.state},
        state_since = CASE WHEN state = ${report.state} THEN state_since ELSE now() END,
        pairing_qr = ${report.state === "pairing" ? (report.qr?.slice(0, 1000) ?? null) : null},
        phone = coalesce(${phone}, phone),
        enabled_at = CASE WHEN ${phone}::text IS NOT NULL THEN coalesce(enabled_at, now()) ELSE enabled_at END,
        -- The command is done once the gateway shows its result.
        command = CASE
          -- A link while connected is a switch: done once the gateway reconnects (state is the old value here).
          WHEN command = 'link' AND (${report.expired} OR (${report.state} = 'connected' AND state <> 'connected')) THEN NULL
          WHEN command = 'unlink' AND ${report.state} IN ('logged_out', 'offline') THEN NULL
          ELSE command END,
        last_seen_at = now(), updated_at = now()
      WHERE id = 1
    `;
    // phone stays after a logout: it is the "old number" when the next one links.
    return before;
  }

  /** Takes the scan turn when the last scan is older than `minutes` (one caller wins). */
  async claimScan(minutes: number): Promise<boolean> {
    const rows = await this.sql`
      UPDATE whatsapp_link SET last_scan_at = now()
      WHERE id = 1 AND enabled_at IS NOT NULL AND (last_scan_at IS NULL OR last_scan_at < now() - make_interval(mins => ${minutes}))
      RETURNING 1
    `;
    return rows.length > 0;
  }

  async applyResults(results: GatewayReport["results"], live: boolean): Promise<void> {
    for (const r of results) {
      if (!UUID.test(r.id)) continue;
      if (r.ok) {
        const [row] = (await this.sql`
          UPDATE whatsapp_messages SET status = 'sent', sent_at = now(), error = NULL, sent_to = ${r.sentTo?.slice(0, 15) ?? null}
          WHERE id = ${r.id} AND status = 'sending' RETURNING kind, client_id, phone
        `) as { kind: string; client_id: string; phone: string }[];
        if (row && (row.kind === "intro" || row.kind === "number")) {
          // Only a live intro counts. In test mode it went to the owner: free its key so the real one is sent once live.
          if (live) await this.sql`UPDATE clients SET whatsapp_intro_phone = ${row.phone} WHERE id = ${row.client_id}`;
          else await this.sql`UPDATE whatsapp_messages SET dedupe_key = 'test:' || id || ':' || dedupe_key WHERE id = ${r.id}`;
        }
      } else {
        await this.sql`
          UPDATE whatsapp_messages SET status = 'failed', error = ${(r.error ?? "Failed").slice(0, 300)}
          WHERE id = ${r.id} AND status = 'sending'
        `;
      }
    }
  }

  /**
   * Hands the gateway the next messages. Live: to the student, intro first, and
   * nothing else until their intro went out. Test mode: everything goes to the
   * owner's test number, marked with who it was for. Quiet hours hold all but
   * quietOk messages; stale ones expire instead of going out late.
   */
  async claim(link: WhatsAppLink, origin: string, now = new Date()): Promise<GatewayMessage[]> {
    await this.sql`
      UPDATE whatsapp_messages SET status = 'expired'
      WHERE status = 'queued' AND (expires_at < now() OR created_at < now() - interval '7 days')
    `;
    await this.sql`
      UPDATE whatsapp_messages SET status = 'unknown', error = 'No result from the gateway: it may or may not have been sent.'
      WHERE status = 'sending' AND claimed_at < now() - make_interval(mins => ${WhatsAppOutbox.CLAIM_MINUTES})
    `;
    // A document can change while its message waits (quiet hours): never send a voided one, nor chase a paid invoice.
    await this.sql`
      UPDATE whatsapp_messages m SET status = 'cancelled', error = 'The document was voided or paid before this went out.'
      FROM invoices d
      WHERE m.status = 'queued' AND m.ref = 'doc:' || d.id AND (d.status = 'void' OR (m.kind = 'overdue' AND d.status <> 'sent'))
    `;
    const test = link.live ? null : link.testPhone;
    if (link.state !== "connected" || !link.gatewayOn || (!link.live && !test)) return [];
    const quiet = WhatsAppText.isQuiet(now);
    const rows = (await this.sql`
      WITH next AS (
        SELECT m.id FROM whatsapp_messages m JOIN clients c ON c.id = m.client_id
        WHERE m.status = 'queued' AND m.not_before <= now() AND NOT c.whatsapp_off
          AND (NOT ${quiet} OR m.quiet_ok)
          AND (${test}::text IS NOT NULL OR m.kind IN ('intro', 'number') OR c.whatsapp_intro_phone = m.phone)
        ORDER BY (m.kind IN ('intro', 'number')) DESC, m.created_at
        LIMIT ${WhatsAppOutbox.BATCH}
        FOR UPDATE OF m SKIP LOCKED
      )
      UPDATE whatsapp_messages m SET status = 'sending', claimed_at = now()
      FROM next, clients c WHERE m.id = next.id AND c.id = m.client_id
      RETURNING m.id, m.phone, m.body, m.document_token, m.attachment_name, c.name
    `) as { id: string; phone: string; body: string; document_token: string | null; attachment_name: string | null; name: string }[];
    return rows.map((r) => ({
      id: r.id,
      to: test ?? r.phone,
      text: test ? `[TEST: for ${r.name}, +${r.phone}]\n\n${r.body}` : r.body,
      pdfUrl: r.document_token ? `${origin}/invoice/${r.document_token}` : null,
      fileName: r.document_token ? (r.attachment_name ?? "document.pdf") : null,
    }));
  }

  /** A STOP or START reply from a student's number. */
  async optOut(phone: string, off: boolean): Promise<void> {
    const clients = (await this.sql`SELECT id, phone FROM clients WHERE phone <> ''`) as { id: string; phone: string }[];
    const ids = clients.filter((c) => WhatsAppText.phone(c.phone) === phone).map((c) => c.id);
    if (ids.length === 0) return;
    await this.sql`UPDATE clients SET whatsapp_off = ${off} WHERE id = ANY(${ids}::uuid[])`;
    if (off) await this.sql`UPDATE whatsapp_messages SET status = 'cancelled' WHERE client_id = ANY(${ids}::uuid[]) AND status = 'queued'`;
  }

  /** Clients who have had the intro on their current number (they get "new number" messages). */
  async introduced(): Promise<{ id: string; name: string; email: string; phone: string }[]> {
    return (await this.sql`
      SELECT id, name, email, phone FROM clients WHERE whatsapp_intro_phone IS NOT NULL AND NOT whatsapp_off AND phone <> ''
    `) as { id: string; name: string; email: string; phone: string }[];
  }

  async markAlerted(): Promise<boolean> {
    const rows = await this.sql`
      UPDATE whatsapp_link SET alerted_at = now()
      WHERE id = 1 AND (alerted_at IS NULL OR alerted_at < state_since) RETURNING 1
    `;
    return rows.length > 0;
  }

  // Owner actions.

  async requestLink(): Promise<void> {
    await this.sql`UPDATE whatsapp_link SET command = 'link', pairing_qr = NULL, gateway_on = true, updated_at = now() WHERE id = 1`;
  }

  async requestUnlink(): Promise<void> {
    await this.sql`UPDATE whatsapp_link SET command = 'unlink', pairing_qr = NULL, updated_at = now() WHERE id = 1`;
  }

  /** Off also drops a pending link, so the gateway doesn't go back to showing QR codes when switched on. */
  async setGatewayOn(on: boolean): Promise<void> {
    await this.sql`
      UPDATE whatsapp_link SET gateway_on = ${on},
        command = CASE WHEN ${on} OR command <> 'link' THEN command END,
        updated_at = now()
      WHERE id = 1
    `;
  }

  async setMode(live: boolean, testPhone: string | null): Promise<void> {
    await this.sql`UPDATE whatsapp_link SET live = ${live}, test_phone = ${testPhone}, updated_at = now() WHERE id = 1`;
  }

  async recent(limit = 60): Promise<MessageRow[]> {
    const rows = (await this.sql`
      SELECT m.id, m.kind, m.client_id, c.name AS client_name, m.phone, m.body, m.status, m.error, m.sent_to, m.not_before, m.created_at, m.sent_at
      FROM whatsapp_messages m JOIN clients c ON c.id = m.client_id
      ORDER BY m.created_at DESC LIMIT ${limit}
    `) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: r.id as string,
      kind: r.kind as MessageRow["kind"],
      clientId: r.client_id as string,
      clientName: r.client_name as string,
      phone: r.phone as string,
      body: r.body as string,
      status: r.status as MessageRow["status"],
      error: r.error as string | null,
      sentTo: r.sent_to as string | null,
      notBefore: r.not_before as Date,
      createdAt: r.created_at as Date,
      sentAt: r.sent_at as Date | null,
    }));
  }

  /** Failed or unknown -> queued again (the owner decided it is safe to resend). */
  async retry(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`
      UPDATE whatsapp_messages SET status = 'queued', error = NULL, claimed_at = NULL, created_at = now(), expires_at = NULL, not_before = now()
      WHERE id = ${id} AND status IN ('failed', 'unknown', 'expired')
    `;
  }

  async cancel(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`UPDATE whatsapp_messages SET status = 'cancelled' WHERE id = ${id} AND status = 'queued'`;
  }

  async optedOut(): Promise<{ id: string; name: string }[]> {
    return (await this.sql`SELECT id, name FROM clients WHERE whatsapp_off ORDER BY name`) as { id: string; name: string }[];
  }
}
