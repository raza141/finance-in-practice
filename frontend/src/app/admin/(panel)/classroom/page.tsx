import type { Metadata } from "next";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { disconnectClassroom, refreshClassroom } from "@/domains/classroom/actions/classroom";
import { ClassroomAuthError } from "@/domains/classroom/server/ClassroomApi";
import { ClassroomConnection } from "@/domains/classroom/server/ClassroomConnection";
import { ClassroomSync, type ClassOverview } from "@/domains/classroom/server/ClassroomSync";
import { siteConfig } from "@/core/config/site";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";

export const metadata: Metadata = { title: "Classroom" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  connected: { text: "Connected. Students now see their classes' posts, to-do and marks in the portal.", tone: "ok" },
  disconnected: { text: "Disconnected, and the access was revoked at Google.", tone: "ok" },
  refreshed: { text: "Refreshed from Google.", tone: "ok" },
  cancelled: { text: "Connection cancelled at Google.", tone: "warn" },
  expired: { text: "That attempt expired. Please connect again.", tone: "warn" },
  failed: { text: "Google didn't accept the connection. Please try again.", tone: "warn" },
  "missing-scopes": { text: "Not connected: on Google's screen, tick every box (or Select all), then Continue.", tone: "warn" },
  "no-refresh-token": { text: "Google didn't give a lasting key. Remove the app at myaccount.google.com/permissions, then connect again.", tone: "warn" },
  "not-configured": { text: "Classroom isn't set up on this deployment: add CLASSROOM_CLIENT_ID and CLASSROOM_CLIENT_SECRET.", tone: "warn" },
};

const BUTTON = "inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold";
const fmt = (n: number | null) => (n === null ? "—" : `${n}%`);

/** Owner: connect Google Classroom (read only), see which classes feed which course, and every student's progress. */
export default async function AdminClassroomPage({ searchParams }: { searchParams: Promise<{ notice?: string; missing?: string }> }) {
  await AdminAuth.requireOwner();
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const missing = query.notice === "missing-scopes" ? String(query.missing ?? "").split(",").filter((m) => /^classroom\.[a-z.]+$/.test(m)) : [];
  const configured = ClassroomSync.isConfigured();
  const connection = configured ? await ClassroomConnection.fromEnv()?.current() : null;

  let classes: ClassOverview[] = [];
  let problem: string | null = null;
  if (connection) {
    try {
      classes = await ClassroomSync.overview((await ClassroomRepository.fromEnv()?.allLinks()) ?? []);
    } catch (error) {
      console.error("[admin/classroom] overview failed", error);
      problem =
        error instanceof ClassroomAuthError
          ? "Google no longer accepts this connection (revoked, or unused for 6 months). Disconnect and connect again."
          : "Couldn't reach Google Classroom just now. Refresh in a minute.";
    }
  }

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-normal tracking-tight italic">Google Classroom</h1>
      <p className="mt-2 text-sm text-muted">
        Read only: the website shows each student what you post in Classroom (quizzes, homework, files, announcements), their to-do and the marks you
        return. Mocks are the work under a topic named &ldquo;Mock exams&rdquo;. Updates appear within 5 minutes.
      </p>
      {notice && (
        <p role="status" className={`mt-4 text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
          {notice.text}
          {missing.length > 0 && (
            <span className="mt-1 block">
              Google didn&rsquo;t grant: {missing.map((m) => <code key={m} className="mr-2 text-ink">{m}</code>)}
            </span>
          )}
        </p>
      )}

      <section className="mt-8 rounded-lg border border-line p-5">
        {!configured ? (
          <p className="text-sm text-gold">Not set up yet: add CLASSROOM_CLIENT_ID and CLASSROOM_CLIENT_SECRET on Vercel, then redeploy.</p>
        ) : connection ? (
          <div className="flex flex-wrap items-center gap-4">
            <p className="flex-1 text-sm">
              Connected as <span className="font-semibold">{connection.email}</span>
              <span className="text-muted"> · since {new Date(connection.connectedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })}</span>
            </p>
            <form action={refreshClassroom}>
              <PendingButton pendingLabel="Refreshing…" className={`${BUTTON} border border-line font-normal hover:border-quant/60`}>
                Refresh now
              </PendingButton>
            </form>
            <form action={disconnectClassroom}>
              <PendingButton pendingLabel="Disconnecting…" className={`${BUTTON} border border-red-400/50 font-normal text-red-300 hover:bg-red-400/10`}>
                Disconnect
              </PendingButton>
            </form>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <p className="flex-1 text-sm text-muted">
              Sign in with the Google account that owns your classes. Google warns that the app isn&rsquo;t verified: it&rsquo;s yours, so choose
              Advanced → Go to {siteConfig.name}, then tick every box.
            </p>
            {/* A plain link: the route redirects to Google. */}
            <a href="/api/admin/classroom/connect" className={`${BUTTON} bg-quant text-canvas hover:bg-quant/90`}>
              Connect Google Classroom
            </a>
          </div>
        )}
        {problem && (
          <p role="alert" className="mt-4 text-sm text-gold">
            {problem}
          </p>
        )}
      </section>

      {classes.length > 0 && (
        <div className="mt-8 grid gap-6">
          {classes.map(({ course, linkedTo, students }) => (
            <section key={course.id} className="rounded-lg border border-line p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-lg">
                  {course.name}
                  {course.section && <span className="text-muted"> · {course.section}</span>}
                </h2>
                {course.alternateLink && (
                  <a href={course.alternateLink} target="_blank" rel="noreferrer" className="text-sm text-quant hover:underline">
                    Open in Classroom ↗
                  </a>
                )}
              </div>
              {linkedTo.length === 0 ? (
                <p className="mt-2 text-sm text-gold">
                  Not on the website yet: paste this class&rsquo;s invite link on its course (Courses → Google Classroom) or as a student&rsquo;s private
                  classroom (Clients).
                </p>
              ) : (
                <>
                  <p className="mt-1 text-sm text-muted">Shown on: {linkedTo.join(", ")}</p>
                  {students.length === 0 ? (
                    <p className="mt-4 text-sm text-muted">No students have joined this class yet.</p>
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[40rem] text-left text-sm">
                        <thead className="font-mono text-[11px] tracking-wider text-muted uppercase">
                          <tr>
                            <th className="py-2 font-normal">Student</th>
                            <th className="py-2 font-normal">Mocks</th>
                            <th className="py-2 font-normal">Latest</th>
                            <th className="py-2 font-normal">Average</th>
                            <th className="py-2 font-normal">Change</th>
                            <th className="py-2 font-normal">To do</th>
                            <th className="py-2 font-normal">Missing</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line/60">
                          {students.map((s) => {
                            const below = s.progress.latest !== null && s.progress.latest < siteConfig.classroom.targetPct;
                            return (
                              <tr key={s.email || s.name}>
                                <td className="py-2">
                                  {s.name}
                                  <span className="block text-xs text-muted">{s.email}</span>
                                </td>
                                <td className="py-2">{s.progress.mocks.length}</td>
                                <td className={`py-2 ${below ? "font-semibold text-gold" : ""}`}>{fmt(s.progress.latest)}</td>
                                <td className="py-2">{fmt(s.progress.average)}</td>
                                <td className="py-2">{s.progress.change === null ? "—" : `${s.progress.change > 0 ? "+" : ""}${s.progress.change}`}</td>
                                <td className="py-2">{s.todo}</td>
                                <td className={`py-2 ${s.missing > 0 ? "font-semibold text-red-300" : ""}`}>{s.missing}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </section>
          ))}
        </div>
      )}
      {connection && !problem && classes.length === 0 && <p className="mt-8 text-sm text-muted">No active classes found in this Google account.</p>}
    </div>
  );
}
