import "server-only";

import { Database } from "@/core/db/Database";
import { ResendClient } from "@/core/email/ResendClient";
import { EmailLink } from "@/domains/students/server/EmailLink";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";

import { ClassFeed } from "../services/ClassFeed";
import { WeeklyEmail } from "../services/WeeklyEmail";
import type { EmailMessage } from "@/core/email/EmailHtml";

import { ClassroomSync } from "./ClassroomSync";

type Student = { id: string; name: string; email: string; courses: string[] };

export interface DigestResult {
  sent: number;
  /** Nothing new for them this week, or no Classroom. */
  quiet: number;
  failed: number;
}

/**
 * Sunday's "your week in class" email to every enrolled student with a
 * Classroom (042_weekly_digest). digest_sent_at makes a repeated run harmless.
 * Outside production the emails are logged, never sent.
 */
export class WeeklyDigest {
  static async run(now = Date.now()): Promise<DigestResult> {
    const sql = Database.sql();
    const classrooms = ClassroomRepository.fromEnv();
    const links = EmailLink.fromEnv();
    const result: DigestResult = { sent: 0, quiet: 0, failed: 0 };
    if (!sql || !classrooms || !links || !(await ClassroomSync.isConnected())) return result;
    const resend = ResendClient.fromEnv();
    const live = process.env.NODE_ENV === "production";
    if (live && !resend) return result;

    const students = (await sql`
      SELECT DISTINCT ON (lower(email)) id, name, email, courses FROM clients
      WHERE cardinality(courses) > 0 AND NOT digest_off AND email <> ''
        AND (digest_sent_at IS NULL OR digest_sent_at < now() - interval '6 days')
      ORDER BY lower(email), updated_at DESC
    `) as Student[];

    // One at a time: a handful of students, and Google answers are cached per class.
    for (const s of students) {
      try {
        const message = await WeeklyDigest.messageFor(s, classrooms, links, now);
        if (!message) {
          result.quiet++;
          continue;
        }
        if (live) await resend!.send(s.email, message);
        else console.info(`[weekly-digest] would email ${s.email}: ${message.subject}`);
        await sql`UPDATE clients SET digest_sent_at = now() WHERE id = ${s.id}`;
        result.sent++;
      } catch (error) {
        console.error(`[weekly-digest] failed for client ${s.id}`, error);
        result.failed++;
      }
    }
    return result;
  }

  /** The email this student would get now, or null when there's nothing to say. */
  private static async messageFor(s: Student, classrooms: ClassroomRepository, links: EmailLink, now: number): Promise<EmailMessage | null> {
    const [classes, own] = await Promise.all([classrooms.forClient(s.id, s.courses), classrooms.privateFor(s.id)]);
    const classLinks = [...classes.flatMap((c) => (c.url ? [{ title: c.title, url: c.url }] : [])), ...own.map((c) => ({ title: c.title, url: c.url }))];
    const feed = classLinks.length ? await ClassroomSync.forStudent(s.id, classLinks, now) : null;
    return feed && WeeklyEmail.build(s.name, ClassFeed.week(feed.items, now), WeeklyEmail.PORTAL, links.url(WeeklyEmail.ORIGIN, "unsubscribe", s.id));
  }

  /** Owner check: this student's email as it would go out, sent to the owner's inbox (EMAIL_REPLY_TO) only. */
  static async preview(clientId: string, now = Date.now()): Promise<"sent" | "quiet" | "unavailable"> {
    const sql = Database.sql();
    const classrooms = ClassroomRepository.fromEnv();
    const links = EmailLink.fromEnv();
    const resend = ResendClient.fromEnv();
    const to = process.env.EMAIL_REPLY_TO?.trim();
    if (!sql || !classrooms || !links || !resend || !to || !(await ClassroomSync.isConnected())) return "unavailable";
    const [s] = (await sql`SELECT id, name, email, courses FROM clients WHERE id = ${clientId}`) as Student[];
    const message = s ? await WeeklyDigest.messageFor(s, classrooms, links, now) : null;
    if (!message) return "quiet";
    await resend.send(to, { ...message, subject: `[Preview for ${s.name}] ${message.subject}`.replace(/[\r\n]+/g, " ") });
    return "sent";
  }

  static async switchOff(clientId: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return;
    const sql = Database.sql();
    if (sql) await sql`UPDATE clients SET digest_off = true WHERE id = ${clientId}`;
  }
}
