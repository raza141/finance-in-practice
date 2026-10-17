import "server-only";

import { Database, type Sql } from "@/core/db/Database";
import { ClassroomApi } from "@/domains/classroom/server/ClassroomApi";

import { WhatsAppText } from "../services/WhatsAppText";
import type { ClassPost, ClassRecipient } from "../types";
import { WhatsAppOutbox } from "./WhatsAppOutbox";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = {
  item_id: string;
  course_id: string;
  class_title: string;
  kind: ClassPost["kind"];
  title: string;
  link: string | null;
  due_at: Date | null;
  recipients: ClassRecipient[];
  unmatched: number;
  status: ClassPost["status"];
  posted_at: Date;
};

/** Batch-class posts waiting for the owner's "send to these students", and the nudges for work not handed in. */
export class WhatsAppClassPosts {
  constructor(
    private readonly sql: Sql,
    private readonly outbox: WhatsAppOutbox,
  ) {}

  static fromEnv(): WhatsAppClassPosts | null {
    const sql = Database.sql();
    const outbox = WhatsAppOutbox.fromEnv();
    return sql && outbox ? new WhatsAppClassPosts(sql, outbox) : null;
  }

  private static toPost(r: Row): ClassPost {
    return {
      itemId: r.item_id,
      courseId: r.course_id,
      classTitle: r.class_title,
      kind: r.kind,
      title: r.title,
      link: r.link,
      dueAt: r.due_at,
      recipients: r.recipients,
      unmatched: r.unmatched,
      status: r.status,
      postedAt: r.posted_at,
    };
  }

  async pending(): Promise<ClassPost[]> {
    const rows = (await this.sql`SELECT * FROM whatsapp_class_posts WHERE status = 'pending' ORDER BY posted_at DESC LIMIT 50`) as Row[];
    return rows.map(WhatsAppClassPosts.toPost);
  }

  /** Sent work with a due date in the last two weeks or ahead: what a nudge can still help with. */
  async nudgeable(): Promise<ClassPost[]> {
    const rows = (await this.sql`
      SELECT * FROM whatsapp_class_posts
      WHERE status = 'sent' AND kind IN ('mock', 'assignment') AND due_at > now() - interval '14 days'
      ORDER BY due_at LIMIT 30
    `) as Row[];
    return rows.map(WhatsAppClassPosts.toPost);
  }

  private async byId(itemId: string): Promise<ClassPost | null> {
    const [row] = (await this.sql`SELECT * FROM whatsapp_class_posts WHERE item_id = ${itemId}`) as Row[];
    return row ? WhatsAppClassPosts.toPost(row) : null;
  }

  /**
   * Sends a pending post to the chosen students (only students on the post's own
   * list), with the owner's wording. The post keeps only those students, for later nudges.
   */
  async send(itemId: string, clientIds: readonly string[], template: string, sender: string): Promise<number> {
    const post = await this.byId(itemId);
    if (!post || post.status !== "pending") return 0;
    const chosen = post.recipients.filter((r) => clientIds.includes(r.clientId) && UUID.test(r.clientId));
    const phones = (await this.sql`SELECT id, name, phone FROM clients WHERE id = ANY(${chosen.map((c) => c.clientId)}::uuid[])`) as {
      id: string;
      name: string;
      phone: string;
    }[];
    let queued = 0;
    for (const c of phones) {
      const ok = await this.outbox.enqueue(
        {
          dedupeKey: `class:${itemId}:${c.id}`,
          kind: "class",
          clientId: c.id,
          phone: c.phone,
          body: WhatsAppText.personal(template, c.name),
          ref: `class:${itemId}`,
        },
        sender,
      );
      if (ok) queued++;
    }
    const kept = post.recipients.map((r) => ({ ...r, assigned: chosen.some((c) => c.clientId === r.clientId) }));
    await this.sql`
      UPDATE whatsapp_class_posts SET status = 'sent', recipients = ${JSON.stringify(kept)}::jsonb, decided_at = now()
      WHERE item_id = ${itemId} AND status = 'pending'
    `;
    return queued;
  }

  async dismiss(itemId: string): Promise<void> {
    await this.sql`UPDATE whatsapp_class_posts SET status = 'dismissed', decided_at = now() WHERE item_id = ${itemId} AND status = 'pending'`;
  }

  /** "Not handed in yet" to the post's students whose work isn't turned in or returned. One nudge per student per day. */
  async nudge(itemId: string, sender: string, today: string): Promise<number> {
    const post = await this.byId(itemId);
    const api = await ClassroomApi.fromEnv();
    if (!post || post.status !== "sent" || !api) return 0;
    const submissions = (await api.submissions(post.courseId)).filter((s) => s.courseWorkId === itemId);
    const done = new Set(submissions.filter((s) => s.state === "TURNED_IN" || s.state === "RETURNED").map((s) => s.userId));
    const targets = post.recipients.filter((r) => r.assigned && !done.has(r.userId));
    const clients = (await this.sql`SELECT id, name, phone FROM clients WHERE id = ANY(${targets.map((t) => t.clientId)}::uuid[])`) as {
      id: string;
      name: string;
      phone: string;
    }[];
    let queued = 0;
    for (const c of clients) {
      const ok = await this.outbox.enqueue(
        {
          dedupeKey: `nudge:${itemId}:${c.id}:${today}`,
          kind: "nudge",
          clientId: c.id,
          phone: c.phone,
          body: WhatsAppText.personal(WhatsAppText.nudge(post.title, post.dueAt, post.link), c.name),
          ref: `class:${itemId}`,
        },
        sender,
      );
      if (ok) queued++;
    }
    return queued;
  }

  /** Open invoices past due, for the "remind again" button. */
  async overdueInvoices(): Promise<{ id: string; number: string; clientName: string; dueDate: string; lastReminded: Date | null }[]> {
    const rows = (await this.sql`
      SELECT d.id, d.number, d.client_name, d.due_date::text AS due_date,
        (SELECT max(m.created_at) FROM whatsapp_messages m WHERE m.ref = 'doc:' || d.id AND m.kind = 'overdue') AS last_reminded
      FROM invoices d
      WHERE d.doc_type = 'invoice' AND d.status = 'sent' AND d.client_id IS NOT NULL AND d.due_date < (now() AT TIME ZONE 'Asia/Dubai')::date
      ORDER BY d.due_date LIMIT 30
    `) as { id: string; number: string; client_name: string; due_date: string; last_reminded: Date | null }[];
    return rows.map((r) => ({ id: r.id, number: r.number, clientName: r.client_name, dueDate: r.due_date, lastReminded: r.last_reminded }));
  }
}
