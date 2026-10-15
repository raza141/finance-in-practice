import "server-only";

import type { GCourse, GCourseData, GStudent, GSubmission } from "../types";
import { ClassroomConnection } from "./ClassroomConnection";

const BASE = "https://classroom.googleapis.com/v1";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
/** ponytail: newest 300 per list; add more pages if a class ever posts more. */
const MAX_PAGES = 3;

/** The connection was revoked or expired: the owner has to connect again. */
export class ClassroomAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClassroomAuthError";
  }
}

/** Read-only Google Classroom REST client acting as the connected owner (server only). */
export class ClassroomApi {
  /** One access token per warm instance, refreshed a minute before it expires. */
  private static access: { token: string; expires: number; for: string } | null = null;

  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly refreshToken: string,
    private readonly fetchImpl: typeof fetch = (input, init) => globalThis.fetch(input, init),
  ) {}

  /** Null when not configured or not connected; throws ClassroomAuthError when the stored token can't be read. */
  static async fromEnv(): Promise<ClassroomApi | null> {
    const credentials = ClassroomConnection.credentials();
    const connection = await ClassroomConnection.fromEnv()?.current();
    if (!credentials || !connection) return null;
    if (!connection.refreshToken) throw new ClassroomAuthError("stored token unreadable");
    return new ClassroomApi(credentials.id, credentials.secret, connection.refreshToken);
  }

  /** Revokes the grant at Google (best effort: disconnecting must still work offline). */
  static async revoke(refreshToken: string): Promise<void> {
    try {
      await fetch(`https://oauth2.googleapis.com/revoke?${new URLSearchParams({ token: refreshToken })}`, {
        method: "POST",
        signal: AbortSignal.timeout(8_000),
      });
    } catch (error) {
      console.error("[classroom] revoke failed", error);
    }
  }

  async courses(): Promise<GCourse[]> {
    return this.list<GCourse>("/courses", "courses", { teacherId: "me", courseStates: "ACTIVE" });
  }

  /** Everything posted in a class: work, materials, announcements and topic names. */
  async courseData(courseId: string): Promise<GCourseData> {
    const id = encodeURIComponent(courseId);
    const [work, materials, announcements, topics] = await Promise.all([
      this.list<GCourseData["work"][number]>(`/courses/${id}/courseWork`, "courseWork", { courseWorkStates: "PUBLISHED" }),
      this.list<GCourseData["materials"][number]>(`/courses/${id}/courseWorkMaterials`, "courseWorkMaterial", { courseWorkMaterialStates: "PUBLISHED" }),
      this.list<GCourseData["announcements"][number]>(`/courses/${id}/announcements`, "announcements", { announcementStates: "PUBLISHED" }),
      this.list<{ topicId: string; name: string }>(`/courses/${id}/topics`, "topic", {}),
    ]);
    return { work, materials, announcements, topics };
  }

  async students(courseId: string): Promise<GStudent[]> {
    return this.list<GStudent>(`/courses/${encodeURIComponent(courseId)}/students`, "students", {});
  }

  /** The student's Classroom id in this class, or null when they haven't joined with that email. */
  async studentId(courseId: string, email: string): Promise<string | null> {
    const student = await this.get<GStudent>(`/courses/${encodeURIComponent(courseId)}/students/${encodeURIComponent(email)}`, {}, true);
    return student?.userId ?? null;
  }

  /** Submissions for one student (their Classroom id), or for the whole class when omitted. */
  async submissions(courseId: string, userId?: string): Promise<GSubmission[]> {
    return this.list<GSubmission>(`/courses/${encodeURIComponent(courseId)}/courseWork/-/studentSubmissions`, "studentSubmissions", userId ? { userId } : {});
  }

  private async list<T>(path: string, key: string, params: Record<string, string>): Promise<T[]> {
    const out: T[] = [];
    let pageToken = "";
    for (let page = 0; page < MAX_PAGES; page++) {
      const body = await this.get<Record<string, unknown>>(path, { ...params, pageSize: "100", ...(pageToken && { pageToken }) });
      out.push(...(((body?.[key] as T[] | undefined) ?? [])));
      pageToken = typeof body?.nextPageToken === "string" ? body.nextPageToken : "";
      if (!pageToken) break;
    }
    return out;
  }

  private async get<T>(path: string, params: Record<string, string>, nullOn404 = false): Promise<T | null> {
    const query = new URLSearchParams(params).toString();
    const response = await this.fetchImpl(`${BASE}${path}${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${await this.token()}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (nullOn404 && response.status === 404) return null;
    if (response.status === 401) {
      ClassroomApi.access = null;
      throw new ClassroomAuthError("access token refused");
    }
    if (!response.ok) throw new Error(`Classroom ${path} failed (${response.status}) ${(await response.text().catch(() => "")).slice(0, 200)}`);
    return (await response.json()) as T;
  }

  private async token(): Promise<string> {
    const cached = ClassroomApi.access;
    if (cached && cached.for === this.refreshToken && cached.expires > Date.now() + 60_000) return cached.token;
    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: "refresh_token",
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!response.ok || !body.access_token) {
      if (body.error === "invalid_grant") throw new ClassroomAuthError("refresh token revoked or expired");
      throw new Error(`Classroom token refresh failed (${response.status}) ${body.error ?? ""}`);
    }
    ClassroomApi.access = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000, for: this.refreshToken };
    return body.access_token;
  }
}
