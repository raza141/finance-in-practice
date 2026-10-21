import type { Metadata } from "next";
import Link from "next/link";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { disconnectClassroom, refreshClassroom } from "@/domains/classroom/actions/classroom";
import { ClassroomAuthError } from "@/domains/classroom/server/ClassroomApi";
import { ClassroomConnection } from "@/domains/classroom/server/ClassroomConnection";
import { ClassroomSync, type ClassOverview } from "@/domains/classroom/server/ClassroomSync";
import { siteConfig } from "@/core/config/site";
import { deleteBatch, openBatch, saveBatchLink } from "@/domains/students/actions/classroom";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { PageHeader } from "@/domains/admin/components/PageHeader";

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

const BATCH_NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  opened: { text: "Batch opened. Students who picked that sitting see its class now (once you approve them).", tone: "ok" },
  saved: { text: "Class link saved.", tone: "ok" },
  deleted: { text: "Batch deleted.", tone: "ok" },
  exists: { text: "Not opened: that course already has a batch for that sitting.", tone: "warn" },
  "in-use": { text: "Not deleted: students are in this batch. Move them to another batch on their client page first.", tone: "warn" },
  refused: { text: "Not saved: choose a sitting, and use an invite link starting with https://classroom.google.com/.", tone: "warn" },
  taken: { text: "Not saved: that Google class is already on the website.", tone: "warn" },
};

const BUTTON = "inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold";
const fmt = (n: number | null) => (n === null ? "—" : `${n}%`);

/** Owner: connect Google Classroom (read only), see which classes feed which course, and every student's progress. */
export default async function AdminClassroomPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; missing?: string; batch?: string; reason?: string }>;
}) {
  await AdminAuth.requireOwner();
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const batchNotice = BATCH_NOTICES[String(query.batch)];
  const repo = ClassroomRepository.fromEnv();
  const [batchCourses, batches, unplaced] = await Promise.all([repo?.batchCourses() ?? [], repo?.batches() ?? [], repo?.unplaced() ?? []]);
  const missing = query.notice === "missing-scopes" ? String(query.missing ?? "").split(",").filter((m) => /^classroom\.[a-z.]+$/.test(m)) : [];
  const configured = ClassroomSync.isConfigured();
  const connection = configured ? await ClassroomConnection.fromEnv()?.current() : null;

  let classes: ClassOverview[] = [];
  let problem: string | null = null;
  if (connection) {
    try {
      classes = await ClassroomSync.overview((await repo?.allLinks()) ?? []);
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
      <PageHeader
        title="Google Classroom"
        description={
          <>
            Read only: each student&rsquo;s portal shows what you post in Classroom, their to-do and the marks you return. Mocks are the work under a topic
            named &ldquo;Mock exams&rdquo;. Updates appear within 5 minutes.
          </>
        }
      />
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

      <section id="batches" className="mt-8 rounded-lg border border-line p-5">
        <h2 className="text-lg">Batches</h2>
        <p className="mt-1 text-sm text-muted">
          One Google class per exam course and sitting, e.g. CFA Level I · Feb 2027. Students pick their sitting when they register (open batches plus the
          next sittings, three at most); each sees the class of their batch and asks to join it. Create the class in Google Classroom, then open the batch
          here with its invite link.
        </p>
        {batchNotice && (
          <p role="status" className={`mt-3 text-sm ${batchNotice.tone === "ok" ? "text-quant" : "text-gold"}`}>
            {batchNotice.text}
            {typeof query.reason === "string" && ` ${query.reason}`}
          </p>
        )}
        {unplaced.length > 0 && (
          <div className="mt-4 rounded-md border border-gold/40 bg-gold/5 p-3 text-sm">
            <p className="font-semibold text-gold">Needs a batch ({unplaced.length})</p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {unplaced.map((u) => (
                <li key={`${u.id}-${u.course}`}>
                  <Link href={`/admin/clients/${u.id}#classroom`} className="text-quant hover:underline">
                    {u.name}
                  </Link>{" "}
                  <span className="text-muted">· {u.course}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {batchCourses.length === 0 && <p className="mt-4 text-sm text-muted">No exam course yet (a course whose testimonial ticker is CFA1, CFA2 or FRM1).</p>}
        {batchCourses.map((course) => {
          const opened = batches.filter((b) => b.course === course.title);
          const today = new Date().toISOString().slice(0, 10);
          const openable = course.windows.filter((w) => w.starts >= today && !opened.some((b) => b.label === w.label));
          return (
            <div key={course.title} className="mt-6">
              <h3 className="text-sm font-semibold">{course.title}</h3>
              {opened.length > 0 && (
                <ul className="mt-2 divide-y divide-line/60 text-sm">
                  {opened.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                      <span className="w-24 font-semibold">{b.label}</span>
                      <span className={`w-24 text-xs ${b.examDate < today ? "text-muted" : ""}`}>
                        {b.students} {b.students === 1 ? "student" : "students"}
                        {b.examDate < today && " · sat"}
                      </span>
                      <form action={saveBatchLink} className="flex flex-1 items-center gap-2">
                        <input type="hidden" name="id" value={b.id} />
                        <input
                          name="url"
                          type="url"
                          defaultValue={b.classroomUrl ?? ""}
                          placeholder="No class yet: paste its invite link"
                          aria-label={`${course.title} ${b.label} class link`}
                          className={`${FIELD} ${b.classroomUrl ? "" : "border-gold/60"}`}
                        />
                        <PendingButton pendingLabel="Saving…" className="h-9 shrink-0 rounded-md border border-line px-3 text-xs hover:bg-white/5">
                          Save
                        </PendingButton>
                      </form>
                      {b.students === 0 && (
                        <form action={deleteBatch}>
                          <input type="hidden" name="id" value={b.id} />
                          <PendingButton pendingLabel="Deleting…" className="h-9 rounded-md border border-red-400/50 px-3 text-xs text-red-300 hover:bg-red-400/10">
                            Delete
                          </PendingButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {openable.length > 0 && (
                <form action={openBatch} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="course" value={course.title} />
                  <select name="label" required defaultValue="" aria-label={`${course.title} sitting`} className="h-9 rounded-md border border-line bg-canvas px-2 text-sm">
                    <option value="" disabled>
                      Sitting
                    </option>
                    {openable.map((w) => (
                      <option key={w.label} value={w.label}>
                        {w.label}
                      </option>
                    ))}
                  </select>
                  <input name="url" type="url" placeholder="Invite link (or add it later)" aria-label="Class invite link" className={`${FIELD} flex-1`} />
                  <PendingButton pendingLabel="Opening…" className="h-9 shrink-0 rounded-md bg-quant/15 px-3 text-xs font-medium text-quant hover:bg-quant/25">
                    Open batch
                  </PendingButton>
                </form>
              )}
            </div>
          );
        })}
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
