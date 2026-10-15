import type { ClassItem, GCourse, GCourseData, GMaterial, GSubmission, GWork } from "../types";

export interface Progress {
  /** Graded mocks, oldest first. */
  mocks: { id: string; title: string; pct: number; at: string; link: string | null }[];
  latest: number | null;
  average: number | null;
  best: number | null;
  /** Latest minus first mock, in percentage points. */
  change: number | null;
  /** Graded work outside the mocks, by Classroom topic, weakest first. */
  topics: { name: string; pct: number; count: number }[];
}

const DAY = 86_400_000;
const pct = (g: { points: number; max: number }) => Math.round((g.points / g.max) * 1000) / 10;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/**
 * Turns Google Classroom API data into what one student sees. Pure: the
 * server fetches, this decides visibility, status, grades and progress.
 */
export class ClassFeed {
  /** Items newer than this many days count as "New" when the feed was never opened. */
  static readonly NEW_DAYS = 14;

  /** The Google class behind a stored invite or class link: same /c/<id> segment, or the join code. */
  static match(url: string, courses: readonly GCourse[]): GCourse | null {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return null;
    }
    const segment = (u: string | undefined) => (u ? /\/c\/([^/?#]+)/.exec(u)?.[1] ?? null : null);
    const id = segment(parsed.pathname);
    const code = parsed.searchParams.get("cjc");
    return courses.find((c) => (id !== null && segment(c.alternateLink) === id) || (code !== null && c.enrollmentCode === code)) ?? null;
  }

  static dueAt(work: Pick<GWork, "dueDate" | "dueTime">): string | null {
    const d = work.dueDate;
    if (!d) return null;
    const t = work.dueTime ?? {};
    // Classroom stores due times in UTC; a date without a time means the end of that day.
    return new Date(Date.UTC(d.year, d.month - 1, d.day, t.hours ?? (work.dueTime ? 0 : 23), t.minutes ?? (work.dueTime ? 0 : 59))).toISOString();
  }

  /** Everything in one class this student may see. `userId` null: they haven't joined, so no statuses. */
  static items(classTitle: string, data: GCourseData, userId: string | null, submissions: readonly GSubmission[], now = Date.now()): ClassItem[] {
    const topics = new Map(data.topics.map((t) => [t.topicId, t.name]));
    const mine = new Map(submissions.filter((s) => !userId || s.userId === userId).map((s) => [s.courseWorkId, s]));
    const visible = (x: { assigneeMode?: string; individualStudentsOptions?: { studentIds?: string[] } }) =>
      x.assigneeMode !== "INDIVIDUAL_STUDENTS" || (userId !== null && (x.individualStudentsOptions?.studentIds ?? []).includes(userId));
    const base = (x: { id: string; alternateLink?: string; creationTime?: string; updateTime?: string; topicId?: string; materials?: GMaterial[] }) => {
      const topic = x.topicId ? (topics.get(x.topicId) ?? null) : null;
      return {
        id: x.id,
        classTitle,
        link: x.alternateLink ?? null,
        postedAt: x.creationTime ?? x.updateTime ?? new Date(now).toISOString(),
        topic,
        mock: topic !== null && /mock/i.test(topic),
        files: ClassFeed.files(x.materials),
      };
    };

    const work = data.work.filter(visible).map((w): ClassItem => {
      const s = userId ? mine.get(w.id) : undefined;
      const dueAt = ClassFeed.dueAt(w);
      const handed = s?.state === "TURNED_IN";
      const returned = s?.state === "RETURNED";
      const status = !s ? null : returned ? "returned" : handed ? "done" : dueAt && Date.parse(dueAt) < now ? "missing" : "todo";
      const graded = returned && typeof s?.assignedGrade === "number" && (w.maxPoints ?? 0) > 0;
      return {
        ...base(w),
        kind: w.materials?.some((m) => m.form) ? "quiz" : w.workType && w.workType !== "ASSIGNMENT" ? "question" : "assignment",
        title: w.title,
        text: ClassFeed.clip(w.description),
        dueAt,
        status,
        late: s?.late === true,
        grade: graded ? { points: s!.assignedGrade!, max: w.maxPoints! } : null,
        // A quiz's form opens from Classroom (so the mark lands there), not as a loose file.
        files: ClassFeed.files(w.materials?.filter((m) => !m.form)),
      };
    });
    const materials = data.materials.filter(visible).map(
      (m): ClassItem => ({ ...base(m), kind: "material", title: m.title, text: ClassFeed.clip(m.description), dueAt: null, status: null, late: false, grade: null }),
    );
    const announcements = data.announcements.filter(visible).map((a): ClassItem => {
      const text = (a.text ?? "").trim();
      return {
        ...base(a),
        kind: "announcement",
        title: ClassFeed.clip(text.split("\n")[0], 90) || "Announcement",
        text: ClassFeed.clip(text.split("\n").slice(1).join(" ")),
        dueAt: null,
        status: null,
        late: false,
        grade: null,
        mock: false,
      };
    });
    return [...work, ...materials, ...announcements].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  }

  static isNew(item: ClassItem, seenAt: string | null, now = Date.now()): boolean {
    const posted = Date.parse(item.postedAt);
    return seenAt ? posted > Date.parse(seenAt) : posted > now - ClassFeed.NEW_DAYS * DAY;
  }

  /** Work still to hand in: missing first, then by due date (undated last). */
  static todo(items: readonly ClassItem[]): ClassItem[] {
    const due = (i: ClassItem) => (i.dueAt ? Date.parse(i.dueAt) : Infinity);
    return items.filter((i) => i.status === "todo" || i.status === "missing").sort((a, b) => (a.status === b.status ? due(a) - due(b) : a.status === "missing" ? -1 : 1));
  }

  static dueWithin(items: readonly ClassItem[], days: number, now = Date.now()): ClassItem[] {
    return items.filter((i) => i.status === "todo" && i.dueAt !== null && Date.parse(i.dueAt) <= now + days * DAY);
  }

  static progress(items: readonly ClassItem[]): Progress {
    const graded = items.filter((i): i is ClassItem & { grade: NonNullable<ClassItem["grade"]> } => i.grade !== null);
    const mocks = graded
      .filter((i) => i.mock)
      .map((i) => ({ id: i.id, title: i.title, pct: pct(i.grade), at: i.dueAt ?? i.postedAt, link: i.link }))
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const byTopic = new Map<string, number[]>();
    for (const i of graded.filter((g) => !g.mock)) byTopic.set(i.topic ?? "Other", [...(byTopic.get(i.topic ?? "Other") ?? []), pct(i.grade)]);
    const scores = mocks.map((m) => m.pct);
    return {
      mocks,
      latest: scores.at(-1) ?? null,
      average: avg(scores),
      best: scores.length ? Math.max(...scores) : null,
      change: scores.length >= 2 ? Math.round((scores.at(-1)! - scores[0]) * 10) / 10 : null,
      topics: [...byTopic].map(([name, xs]) => ({ name, pct: avg(xs)!, count: xs.length })).sort((a, b) => a.pct - b.pct),
    };
  }

  private static files(materials: readonly GMaterial[] | undefined): { title: string; url: string }[] {
    return (materials ?? []).flatMap((m) => {
      const pick = m.driveFile?.driveFile
        ? { title: m.driveFile.driveFile.title, url: m.driveFile.driveFile.alternateLink }
        : m.youtubeVideo
          ? { title: m.youtubeVideo.title, url: m.youtubeVideo.alternateLink }
          : m.link
            ? { title: m.link.title, url: m.link.url }
            : m.form
              ? { title: m.form.title, url: m.form.formUrl }
              : null;
      return pick?.url?.startsWith("https://") ? [{ title: pick.title || "Open", url: pick.url }] : [];
    });
  }

  private static clip(text: string | undefined, max = 220): string {
    const t = (text ?? "").replace(/\s+/g, " ").trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  }
}
