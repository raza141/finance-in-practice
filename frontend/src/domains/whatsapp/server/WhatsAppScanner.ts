import "server-only";

import { Database, type Sql } from "@/core/db/Database";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { ClassroomApi } from "@/domains/classroom/server/ClassroomApi";
import { ClassroomSync } from "@/domains/classroom/server/ClassroomSync";
import { ClassFeed } from "@/domains/classroom/services/ClassFeed";
import type { GCourseData } from "@/domains/classroom/types";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { DocumentFormat } from "@/domains/invoices/services/DocumentFormat";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";
import type { BillingSettings } from "@/domains/settings/types";

import { WhatsAppText } from "../services/WhatsAppText";
import type { ClassPostKind, ClassRecipient, WhatsAppLink } from "../types";
import { WhatsAppOutbox } from "./WhatsAppOutbox";

const DAY = 86_400_000;
type Client = { id: string; name: string; phone: string };

/**
 * Finds what should be announced and queues it: confirmed Cal.com bookings and
 * their reminders, issued invoices and receipts, overdue invoices, and new
 * Classroom posts. It reads the current state each time rather than hooking every
 * place a booking or document changes, so a booking confirmed from Cal.com's own
 * email counts too. Only things after the number was first linked (enabled_at)
 * are announced. Each part fails on its own.
 */
export class WhatsAppScanner {
  constructor(
    private readonly sql: Sql,
    private readonly outbox: WhatsAppOutbox,
    private readonly link: WhatsAppLink,
    private readonly origin: string,
    private readonly settings: BillingSettings,
  ) {}

  static async create(link: WhatsAppLink, origin: string): Promise<WhatsAppScanner | null> {
    const sql = Database.sql();
    const outbox = WhatsAppOutbox.fromEnv();
    if (!sql || !outbox || !link.enabledAt) return null;
    return new WhatsAppScanner(sql, outbox, link, origin, await SettingsRepository.load());
  }

  private get sender(): string {
    return this.settings.business.sender;
  }

  async run(now = new Date()): Promise<Record<string, string>> {
    const parts: [string, () => Promise<number>][] = [
      ["bookings", () => this.bookings(now)],
      ["documents", () => this.documents()],
      ["overdue", () => this.overdue(now)],
      ["classroom", () => this.classroom(now)],
    ];
    const result: Record<string, string> = {};
    for (const [name, part] of parts) {
      try {
        result[name] = String(await part());
      } catch (error) {
        console.error(`[whatsapp] ${name} scan failed`, error);
        result[name] = "failed";
      }
    }
    return result;
  }

  private async clientByEmail(email: string): Promise<Client | null> {
    const [row] = (await this.sql`
      SELECT id, name, phone FROM clients WHERE lower(email) = lower(${email}) AND phone <> '' ORDER BY updated_at DESC LIMIT 1
    `) as Client[];
    return row ?? null;
  }

  private static where(b: CalBookingDetail): string | null {
    if (b.meetingUrl) return b.meetingUrl;
    const location = b.location?.trim();
    if (!location || location.startsWith("integrations:")) return null;
    return location;
  }

  /** Confirmed bookings: a confirmation once, and the day-before and hour-before reminders. Cancelled ones drop what's queued. */
  async bookings(now: Date): Promise<number> {
    const cal = CalComClient.fromEnv();
    if (!cal) return 0;
    const list = await cal.bookings(new Date(now.getTime() - 2 * 3_600_000).toISOString(), new Date(now.getTime() + 60 * DAY).toISOString());
    let queued = 0;
    for (const b of list) {
      if (b.status.toLowerCase() !== "accepted") {
        await this.outbox.cancelFor(`booking:${b.uid}`);
        continue;
      }
      const start = new Date(b.start);
      if (start <= now) continue;
      const createdAt = new Date(b.createdAt);
      await this.outbox.cancelOtherTimes(`booking:${b.uid}`, `booking:${b.uid}:${b.start}:`);
      for (const attendee of b.attendees) {
        const client = await this.clientByEmail(attendee.email);
        if (!client) continue;
        const base = { clientId: client.id, phone: client.phone, ref: `booking:${b.uid}` };
        const where = WhatsAppScanner.where(b);
        if (createdAt > this.link.enabledAt!) {
          const ok = await this.outbox.enqueue(
            {
              ...base,
              dedupeKey: `booking:${b.uid}:${b.start}:${client.id}:confirmed`,
              kind: "booking",
              body: WhatsAppText.bookingConfirmed(client.name, b.title, start, attendee.timeZone, where),
              expiresAt: start,
            },
            this.sender,
          );
          if (ok) queued++;
        }
        for (const plan of WhatsAppText.reminders(start, createdAt)) {
          // Queued only once due soon, so a booking cancelled in between never had one waiting.
          if (plan.notBefore.getTime() - now.getTime() > 30 * 60_000) continue;
          const ok = await this.outbox.enqueue(
            {
              ...base,
              dedupeKey: `booking:${b.uid}:${b.start}:${client.id}:${plan.key}`,
              kind: "reminder",
              body: WhatsAppText.reminder(plan.key, client.name, b.title, start, attendee.timeZone, where),
              notBefore: plan.notBefore,
              expiresAt: plan.expiresAt,
              quietOk: plan.quietOk,
            },
            this.sender,
          );
          if (ok) queued++;
        }
      }
    }
    return queued;
  }

  /** Invoices and receipts issued since WhatsApp was switched on, each once, with its PDF. */
  async documents(): Promise<number> {
    const rows = (await this.sql`
      SELECT d.id FROM invoices d
      WHERE d.doc_type IN ('invoice', 'receipt') AND d.status NOT IN ('draft', 'void') AND d.client_id IS NOT NULL
        AND d.sent_at > ${this.link.enabledAt}
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.dedupe_key = 'doc:' || d.id)
      ORDER BY d.sent_at LIMIT 20
    `) as { id: string }[];
    const repo = InvoiceRepository.fromEnv();
    if (!repo) return 0;
    let queued = 0;
    for (const { id } of rows) {
      const doc = await repo.byId(id);
      if (!doc?.clientId) continue;
      const client = await this.clientById(doc.clientId);
      const phone = client?.phone || doc.clientPhone;
      if (!client || !phone) continue;
      const url = `${this.origin}/invoice/${doc.token}`;
      const ok = await this.outbox.enqueue(
        {
          dedupeKey: `doc:${doc.id}`,
          kind: doc.docType === "receipt" ? "receipt" : "invoice",
          clientId: client.id,
          phone,
          body: InvoiceEmails.whatsappText(doc, url, this.settings),
          ref: `doc:${doc.id}`,
          documentToken: doc.token,
          attachmentName: `${DocumentFormat.filename(doc)}.pdf`,
        },
        this.sender,
      );
      if (ok) queued++;
    }
    return queued;
  }

  private async clientById(id: string): Promise<Client | null> {
    const [row] = (await this.sql`SELECT id, name, phone FROM clients WHERE id = ${id}`) as Client[];
    return row ?? null;
  }

  /** One automatic reminder for an open invoice 5 days past due (issued since WhatsApp was switched on). More only from the button. */
  async overdue(now: Date): Promise<number> {
    const today = new ZonedCalendar(WhatsAppText.ZONE).today(now);
    const rows = (await this.sql`
      SELECT d.id FROM invoices d
      WHERE d.doc_type = 'invoice' AND d.status = 'sent' AND d.client_id IS NOT NULL
        AND d.sent_at > ${this.link.enabledAt} AND d.sent_at < now() - interval '1 day'
        AND d.due_date <= ${ZonedCalendar.addDays(today, -WhatsAppText.OVERDUE_DAYS)}::date
        AND NOT EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.dedupe_key = 'overdue:' || d.id || ':auto')
      LIMIT 20
    `) as { id: string }[];
    let queued = 0;
    for (const { id } of rows) if (await this.remind(id, "auto")) queued++;
    return queued;
  }

  /** Queues an overdue reminder for one invoice. `key` "auto" for the automatic one, a timestamp for the button. */
  async remind(invoiceId: string, key: string): Promise<boolean> {
    const doc = await InvoiceRepository.fromEnv()?.byId(invoiceId);
    if (!doc?.clientId || doc.docType !== "invoice" || doc.status !== "sent" || !doc.number) return false;
    const balance = doc.totalMinor - doc.paidMinor - doc.creditedMinor;
    if (balance <= 0) return false;
    const client = await this.clientById(doc.clientId);
    const phone = client?.phone || doc.clientPhone;
    if (!client || !phone) return false;
    const url = `${this.origin}/invoice/${doc.token}`;
    return this.outbox.enqueue(
      {
        dedupeKey: `overdue:${doc.id}:${key}`,
        kind: "overdue",
        clientId: client.id,
        phone,
        body: WhatsAppText.overdue(client.name, doc.number, InvoiceMath.money(balance, doc.currency), doc.dueDate, url, this.sender),
        ref: `doc:${doc.id}`,
        documentToken: doc.token,
        attachmentName: `${DocumentFormat.filename(doc)}.pdf`,
      },
      this.sender,
    );
  }

  /**
   * New Classroom posts. A private class (one student, from private_classrooms)
   * sends at once; any other class (course or batch) waits in admin for the owner
   * to choose who gets it, with whoever Classroom assigned it to pre-ticked.
   * Only posts from the last 3 days and after WhatsApp was switched on.
   */
  async classroom(now: Date): Promise<number> {
    if (!(await ClassroomSync.isConnected())) return 0;
    const api = await ClassroomApi.fromEnv();
    const repo = ClassroomRepository.fromEnv();
    if (!api || !repo) return 0;
    const since = Math.max(this.link.enabledAt!.getTime(), now.getTime() - 3 * DAY);
    const [courses, links, privates] = await Promise.all([
      api.courses(),
      repo.allLinks(),
      this.sql`SELECT p.url, c.id, c.name, c.phone FROM private_classrooms p JOIN clients c ON c.id = p.client_id` as Promise<unknown> as Promise<
        { url: string; id: string; name: string; phone: string }[]
      >,
    ]);
    let found = 0;
    for (const course of courses) {
      const data = await api.courseData(course.id);
      const posts = WhatsAppScanner.posts(data).filter((p) => Date.parse(p.postedAt) > since);
      if (posts.length === 0) continue;
      const known = new Set(
        ((await this.sql`SELECT item_id FROM whatsapp_class_posts WHERE item_id = ANY(${posts.map((p) => p.id)}::text[])`) as { item_id: string }[]).map(
          (r) => r.item_id,
        ),
      );
      const fresh = posts.filter((p) => !known.has(p.id));
      if (fresh.length === 0) continue;
      const owner = privates.find((p) => ClassFeed.match(p.url, [course]));
      const classTitle = links.find((l) => ClassFeed.match(l.url, [course]))?.title ?? course.name;
      const roster = owner ? Object.assign([], { unmatched: 0 }) : await this.roster(api, course.id);
      for (const post of fresh) {
        const recipients: ClassRecipient[] = owner
          ? []
          : roster.map((r) => ({ ...r, assigned: post.assigneeMode !== "INDIVIDUAL_STUDENTS" || (post.studentIds ?? []).includes(r.userId) }));
        const inserted = await this.sql`
          INSERT INTO whatsapp_class_posts (item_id, course_id, class_title, kind, title, link, due_at, recipients, unmatched, status, posted_at)
          VALUES (${post.id}, ${course.id}, ${classTitle.slice(0, 300)}, ${post.kind}, ${post.title.slice(0, 300)}, ${post.link?.slice(0, 500) ?? null},
                  ${post.dueAt}, ${JSON.stringify(recipients)}::jsonb, ${roster.unmatched}, ${owner ? "auto" : "pending"}, ${post.postedAt})
          ON CONFLICT (item_id) DO NOTHING RETURNING 1
        `;
        if (inserted.length === 0) continue;
        found++;
        if (owner?.phone) {
          await this.outbox.enqueue(
            {
              dedupeKey: `class:${post.id}:${owner.id}`,
              kind: "class",
              clientId: owner.id,
              phone: owner.phone,
              body: WhatsAppText.personal(WhatsAppText.classPost(post.kind, classTitle, post.title, post.dueAt, post.link), owner.name),
              ref: `class:${post.id}`,
            },
            this.sender,
          );
        }
      }
    }
    return found;
  }

  /** The class's students matched to clients (by Classroom email, else portal email). */
  private async roster(api: ClassroomApi, courseId: string): Promise<Omit<ClassRecipient, "assigned">[] & { unmatched: number }> {
    const students = await api.students(courseId);
    const emails = students.flatMap((s) => (s.profile?.emailAddress ? [s.profile.emailAddress.toLowerCase()] : []));
    const clients = (await this.sql`
      SELECT id, name, lower(coalesce(classroom_email, email)) AS key, lower(email) AS email FROM clients
      WHERE lower(coalesce(classroom_email, email)) = ANY(${emails}::text[]) OR lower(email) = ANY(${emails}::text[])
    `) as { id: string; name: string; key: string; email: string }[];
    const matched = students.flatMap((s) => {
      const email = s.profile?.emailAddress?.toLowerCase();
      const client = email ? (clients.find((c) => c.key === email) ?? clients.find((c) => c.email === email)) : undefined;
      return client ? [{ clientId: client.id, name: client.name, userId: s.userId }] : [];
    });
    return Object.assign(matched, { unmatched: students.length - matched.length });
  }

  /** Work, materials and announcements as postable items. Work under a topic with "mock" in its name is a mock exam. */
  static posts(data: GCourseData): {
    id: string;
    kind: ClassPostKind;
    title: string;
    link: string | null;
    dueAt: Date | null;
    postedAt: string;
    assigneeMode?: string;
    studentIds?: string[];
  }[] {
    const mockTopics = new Set(data.topics.filter((t) => /mock/i.test(t.name)).map((t) => t.topicId));
    const common = (x: (typeof data.work)[number] | (typeof data.materials)[number] | (typeof data.announcements)[number]) => ({
      id: x.id,
      link: x.alternateLink ?? null,
      postedAt: x.creationTime ?? new Date(0).toISOString(),
      assigneeMode: x.assigneeMode,
      studentIds: x.individualStudentsOptions?.studentIds,
    });
    return [
      ...data.work.map((w) => ({
        ...common(w),
        kind: (w.topicId && mockTopics.has(w.topicId) ? "mock" : "assignment") as ClassPostKind,
        title: w.title,
        dueAt: w.dueDate
          ? new Date(Date.UTC(w.dueDate.year, w.dueDate.month - 1, w.dueDate.day, w.dueTime ? (w.dueTime.hours ?? 0) : 23, w.dueTime ? (w.dueTime.minutes ?? 0) : 59))
          : null,
      })),
      ...data.materials.map((m) => ({ ...common(m), kind: "material" as ClassPostKind, title: m.title, dueAt: null })),
      ...data.announcements.map((a) => ({
        ...common(a),
        kind: "announcement" as ClassPostKind,
        title: (a.text ?? "").split("\n")[0].slice(0, 120) || "Announcement",
        dueAt: null,
      })),
    ];
  }
}
