import "server-only";

import { unstable_cache } from "next/cache";

import { Database } from "@/core/db/Database";

import { ClassFeed, type Progress } from "../services/ClassFeed";
import type { GCourse, StudentFeed } from "../types";
import { ClassroomApi } from "./ClassroomApi";
import { ClassroomConnection } from "./ClassroomConnection";

/** A class link stored on the website (course invite or private class). */
export interface ClassLink {
  title: string;
  url: string;
}

export interface OverviewRow {
  name: string;
  email: string;
  progress: Progress;
  missing: number;
  todo: number;
}

export interface ClassOverview {
  course: GCourse;
  /** Website courses / private classes whose link points at this class. */
  linkedTo: string[];
  students: OverviewRow[];
}

const api = async () => {
  const client = await ClassroomApi.fromEnv();
  if (!client) throw new Error("Classroom is not connected");
  return client;
};

/**
 * Reads Google Classroom for the portal and the admin. Every Google answer is
 * cached for 5 minutes (shared across visitors and instances), so a busy portal
 * makes a handful of API calls, and connecting or disconnecting clears it.
 */
export class ClassroomSync {
  static readonly TAG = "classroom";
  private static readonly OPTIONS = { revalidate: 300, tags: [ClassroomSync.TAG] };

  private static readonly courses = unstable_cache(async () => (await api()).courses(), ["classroom-courses"], ClassroomSync.OPTIONS);
  private static readonly courseData = unstable_cache(async (courseId: string) => (await api()).courseData(courseId), ["classroom-course-data"], ClassroomSync.OPTIONS);
  private static readonly student = unstable_cache(
    async (courseId: string, email: string) => {
      const client = await api();
      const userId = await client.studentId(courseId, email);
      return { userId, submissions: userId ? await client.submissions(courseId, userId) : [] };
    },
    ["classroom-student"],
    ClassroomSync.OPTIONS,
  );
  private static readonly roster = unstable_cache(
    async (courseId: string) => {
      const client = await api();
      const [students, submissions] = await Promise.all([client.students(courseId), client.submissions(courseId)]);
      return { students, submissions };
    },
    ["classroom-roster"],
    ClassroomSync.OPTIONS,
  );

  /** Configured on this deployment (the env vars are set); says nothing about being connected. */
  static isConfigured(): boolean {
    return ClassroomConnection.credentials() !== null;
  }

  /** Connected right now (one small query; no Google call). */
  static async isConnected(): Promise<boolean> {
    const sql = Database.sql();
    if (!sql || !ClassroomSync.isConfigured()) return false;
    return ((await sql`SELECT 1 FROM classroom_connection WHERE id = 1`) as unknown[]).length > 0;
  }

  /** The student's feed across their classes; null when Classroom isn't set up or connected. Throws when Google fails. */
  static async forStudent(clientId: string, links: readonly ClassLink[], now = Date.now()): Promise<StudentFeed | null> {
    const sql = Database.sql();
    if (!sql || !ClassroomSync.isConfigured() || links.length === 0) return null;
    const [profile] = (await sql`SELECT email, classroom_email, feed_seen_at FROM clients WHERE id = ${clientId}`) as {
      email: string;
      classroom_email: string | null;
      feed_seen_at: Date | null;
    }[];
    if (!profile) return null;
    const email = (profile.classroom_email ?? profile.email).toLowerCase();
    const courses = await ClassroomSync.courses();
    const matched = links.flatMap((link) => {
      const course = ClassFeed.match(link.url, courses);
      return course ? [{ title: link.title, course }] : [];
    });
    // One class failing (e.g. Google refuses its roster) leaves the others showing.
    const settled = await Promise.allSettled(
      matched.map(async ({ title, course }) => {
        const [data, me] = await Promise.all([ClassroomSync.courseData(course.id), ClassroomSync.student(course.id, email)]);
        return { title, joined: me.userId !== null, items: ClassFeed.items(title, data, me.userId, me.submissions, now) };
      }),
    );
    const failed = settled.filter((r) => r.status === "rejected");
    failed.forEach((r) => console.error("[classroom] class failed", r.reason));
    if (matched.length > 0 && failed.length === matched.length) throw failed[0].reason;
    const loaded = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    return {
      classes: loaded.map(({ title, joined }) => ({ title, joined })),
      items: loaded.flatMap((l) => l.items).sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt)),
      seenAt: profile.feed_seen_at ? new Date(profile.feed_seen_at).toISOString() : null,
      email,
    };
  }

  /** Every Google class the owner teaches, what links to it on the website, and each student's progress. */
  static async overview(links: readonly ClassLink[], now = Date.now()): Promise<ClassOverview[]> {
    const courses = await ClassroomSync.courses();
    return Promise.all(
      courses.map(async (course) => {
        const linkedTo = links.filter((l) => ClassFeed.match(l.url, [course])).map((l) => l.title);
        if (linkedTo.length === 0) return { course, linkedTo, students: [] };
        const [data, roster] = await Promise.all([ClassroomSync.courseData(course.id), ClassroomSync.roster(course.id)]);
        const students = roster.students.map((s) => {
          const items = ClassFeed.items(course.name, data, s.userId, roster.submissions, now);
          const todo = ClassFeed.todo(items);
          return {
            name: s.profile?.name?.fullName ?? "Student",
            email: s.profile?.emailAddress ?? "",
            progress: ClassFeed.progress(items),
            missing: todo.filter((i) => i.status === "missing").length,
            todo: todo.length,
          };
        });
        return { course, linkedTo, students };
      }),
    );
  }
}
