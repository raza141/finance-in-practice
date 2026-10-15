import type { ClassItem, GCourse, GCourseData, GMaterial, GSubmission, GWork } from "../types";

export interface Score {
  id: string;
  title: string;
  pct: number;
  at: string;
  link: string | null;
}

export interface Progress {
  /** Graded mocks, oldest first. */
  mocks: Score[];
  latest: number | null;
  average: number | null;
  best: number | null;
  /** Latest minus first mock, in percentage points. */
  change: number | null;
  /** Every returned mark, by Classroom topic (mocks included) in Classroom's topic order, untagged last as "Other"; scores oldest first. */
  topics: { name: string; pct: number; count: number; scores: Score[] }[];
  /** Across every returned mark, not just mocks. */
  overall: { last: Score | null; average: number | null; best: number | null; count: number };
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
    const topics = new Map(data.topics.map((t, i) => [t.topicId, { name: t.name, order: i }]));
    const mine = new Map(submissions.filter((s) => !userId || s.userId === userId).map((s) => [s.courseWorkId, s]));
    const visible = (x: { assigneeMode?: string; individualStudentsOptions?: { studentIds?: string[] } }) =>
      x.assigneeMode !== "INDIVIDUAL_STUDENTS" || (userId !== null && (x.individualStudentsOptions?.studentIds ?? []).includes(userId));
    const base = (x: { id: string; alternateLink?: string; creationTime?: string; updateTime?: string; topicId?: string; materials?: GMaterial[] }) => {
      const found = x.topicId ? topics.get(x.topicId) : undefined;
      const topic = found?.name ?? null;
      return {
        id: x.id,
        classTitle,
        link: x.alternateLink ?? null,
        postedAt: x.creationTime ?? x.updateTime ?? new Date(now).toISOString(),
        topic,
        topicOrder: found?.order ?? null,
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
        gradedAt: graded ? (s!.updateTime ?? null) : null,
        // A quiz's form opens from Classroom (so the mark lands there), not as a loose file.
        files: ClassFeed.files(w.materials?.filter((m) => !m.form)),
      };
    });
    const materials = data.materials.filter(visible).map(
      (m): ClassItem => ({ ...base(m), kind: "material", title: m.title, text: ClassFeed.clip(m.description), dueAt: null, status: null, late: false, grade: null, gradedAt: null }),
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
        gradedAt: null,
        mock: false,
      };
    });
    return [...work, ...materials, ...announcements].sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));
  }

  /** Every post, one group per class and topic in Classroom's topic order; untagged posts last as "Other". */
  static byTopic(items: readonly ClassItem[]): { classTitle: string; topic: string; items: ClassItem[] }[] {
    const groups = new Map<string, { classTitle: string; topic: string; order: number; items: ClassItem[] }>();
    for (const item of items) {
      const key = `${item.classTitle}\u0000${item.topic ?? ""}`;
      const group = groups.get(key) ?? { classTitle: item.classTitle, topic: item.topic ?? "Other", order: item.topicOrder ?? Number.MAX_SAFE_INTEGER, items: [] };
      group.items.push(item);
      groups.set(key, group);
    }
    return [...groups.values()]
      .sort((a, b) => a.classTitle.localeCompare(b.classTitle) || a.order - b.order)
      .map(({ classTitle, topic, items }) => ({ classTitle, topic, items }));
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

  /** The weekly email: due in the next 7 days, missing, posted in the last 7, marks returned in the last 7. */
  static week(items: readonly ClassItem[], now = Date.now()): { due: ClassItem[]; missing: ClassItem[]; fresh: ClassItem[]; marks: ClassItem[] } {
    const recent = (iso: string | null) => iso !== null && Date.parse(iso) > now - 7 * DAY && Date.parse(iso) <= now;
    return {
      due: ClassFeed.dueWithin(items, 7, now).sort((a, b) => Date.parse(a.dueAt!) - Date.parse(b.dueAt!)),
      missing: items.filter((i) => i.status === "missing"),
      fresh: items.filter((i) => recent(i.postedAt)),
      marks: items.filter((i) => i.grade !== null && recent(i.gradedAt)),
    };
  }

  static progress(items: readonly ClassItem[]): Progress {
    const graded = items
      .filter((i): i is ClassItem & { grade: NonNullable<ClassItem["grade"]> } => i.grade !== null)
      .map((i) => ({ item: i, score: { id: i.id, title: i.title, pct: pct(i.grade), at: i.dueAt ?? i.postedAt, link: i.link } }))
      .sort((a, b) => Date.parse(a.score.at) - Date.parse(b.score.at));
    const mocks = graded.filter((g) => g.item.mock).map((g) => g.score);
    const byTopic = new Map<string, { order: number; scores: Score[] }>();
    for (const { item, score } of graded) {
      const name = item.topic ?? "Other";
      const group = byTopic.get(name) ?? { order: item.topicOrder ?? Number.MAX_SAFE_INTEGER, scores: [] };
      group.scores.push(score);
      byTopic.set(name, group);
    }
    const scores = mocks.map((m) => m.pct);
    const all = graded.map((g) => g.score.pct);
    return {
      mocks,
      latest: scores.at(-1) ?? null,
      average: avg(scores),
      best: scores.length ? Math.max(...scores) : null,
      change: scores.length >= 2 ? Math.round((scores.at(-1)! - scores[0]) * 10) / 10 : null,
      topics: [...byTopic]
        .sort(([, a], [, b]) => a.order - b.order)
        .map(([name, g]) => ({ name, pct: avg(g.scores.map((x) => x.pct))!, count: g.scores.length, scores: g.scores })),
      overall: { last: graded.at(-1)?.score ?? null, average: avg(all), best: all.length ? Math.max(...all) : null, count: all.length },
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
