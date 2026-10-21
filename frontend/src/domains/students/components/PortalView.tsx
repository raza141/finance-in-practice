import { Suspense } from "react";

import { LinkedInFollow } from "@/core/components/ui/LinkedInFollow";
import { siteConfig } from "@/core/config/site";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { ClassFeedSidebar, ClassTopics, OverviewClassCards, ProgressPanel, type FeedResult } from "@/domains/classroom/components/ClassroomViews";
import { ClassroomSync } from "@/domains/classroom/server/ClassroomSync";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";

import { ClassroomRepository } from "../server/ClassroomRepository";
import { StudentRepository } from "../server/StudentRepository";
import { StudyPlanRepository } from "../server/StudyPlanRepository";
import { StudentAccount } from "../services/StudentAccount";
import { StudentSessions } from "../services/StudentSessions";
import type { Student, StudentAccountView, StudyPlanItem } from "../types";
import { AccountPanel, AccountSummaryCard } from "./AccountPanel";
import { ClassroomPanel } from "./ClassroomPanel";
import { PortalOverview } from "./PortalOverview";
import { StudentPortal } from "./StudentPortal";
import { StudyPlanTimeline } from "./StudyPlanTimeline";

/** Each source fails on its own: a Cal.com or database hiccup never takes the whole portal down. */
export async function safely<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`student: could not load ${label}`, error);
    return null;
  }
}

async function portalData(student: Student) {
  const classrooms = ClassroomRepository.fromEnv();
  const invoices = InvoiceRepository.fromEnv();
  const [courses, bookings, plan, classes, own, entries, documents, client] = await Promise.all([
    safely("courses", async () => (await StudentRepository.fromEnv()?.bookableCourses(student)) ?? student.courses),
    safely("sessions", async (): Promise<CalBookingDetail[]> =>
      (await CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug)?.bookingsFor(student.email)) ?? [],
    ),
    safely("study plan", async (): Promise<StudyPlanItem[]> => (await StudyPlanRepository.fromEnv()?.forClient(student.id)) ?? []),
    safely("classrooms", async () => (await classrooms?.forClient(student.id, student.courses)) ?? []),
    safely("private classrooms", async () => (await classrooms?.privateFor(student.id)) ?? []),
    // Billing reads only this student's own client id, from their session.
    safely("account", async () => (invoices ? invoices.ledger(student.id) : null)),
    safely("documents", async () => (invoices ? invoices.forClient(student.id) : null)),
    safely("plan", async () => (await ClientRepository.fromEnv()?.byId(student.id)) ?? null),
  ]);
  // No ledger: the money can't be shown, so no account (rather than "all paid").
  const account: StudentAccountView | null = entries
    ? StudentAccount.build({
        entries,
        documents,
        bookings,
        // The public booking link's event (NEXT_PUBLIC_CAL_LINK = user/slug) is the free diagnostic.
        freeSlug: process.env.NEXT_PUBLIC_CAL_LINK?.split("/")[1]?.trim(),
        plan: client?.planUnit && client.planFeeMinor ? { unit: client.planUnit, feeMinor: client.planFeeMinor, currency: client.planCurrency } : null,
      })
    : null;
  return {
    courses: courses ?? student.courses,
    sessions: bookings && StudentSessions.upcoming(bookings),
    past: bookings ? StudentSessions.past(bookings) : [],
    addresses: bookings ? StudentSessions.addresses(bookings) : [],
    plan,
    classes: classes ?? [],
    own: own ?? [],
    account,
  };
}

/** The signed-in student's portal; `readOnly`: an admin viewing it as them (nothing can be booked, changed or marked seen). */
export async function Portal({ student, readOnly = false }: { student: Student; readOnly?: boolean }) {
  const { courses, sessions, past, addresses, plan, classes, own, account } = await portalData(student);
  const hasClassroom = classes.length + own.length > 0;
  // Only approved course classes and the student's own: the same ones they can open.
  const links = [...classes.flatMap((c) => (c.url ? [{ title: c.title, url: c.url }] : [])), ...own.map((c) => ({ title: c.title, url: c.url }))];
  const synced = links.length > 0 && (await safely("classroom connection", () => ClassroomSync.isConnected())) === true;
  // Started now, awaited inside Suspense: Google's answer streams in and never holds up the page.
  const feed: Promise<FeedResult> = synced
    ? ClassroomSync.forStudent(student.id, links).then(
        (f): FeedResult => (f ? { status: "ok", feed: f } : { status: "off" }),
        (error): FeedResult => (console.error("student: could not load the class feed", error), { status: "error" }),
      )
    : Promise.resolve({ status: "off" });
  const loading = (label: string) => <p className="rounded-3xl border border-white/10 bg-canvas/70 p-6 text-sm text-muted">Loading {label}…</p>;

  return (
    <div className="grid gap-6">
      <StudentPortal
        readOnly={readOnly}
        courses={courses}
        lengths={siteConfig.studentBooking.lengths}
        sessions={sessions}
        past={past}
        addresses={addresses}
        plan={<StudyPlanTimeline items={plan} programmes={student.courses} />}
        account={<AccountPanel account={account} />}
        overview={
          <PortalOverview
            sessions={sessions}
            plan={plan}
            accountCard={<AccountSummaryCard account={account} />}
            classCards={
              synced && (
                <Suspense fallback={loading("your class")}>
                  <OverviewClassCards result={feed} />
                </Suspense>
              )
            }
          />
        }
        // No Classroom yet (e.g. a single session): no tab, nothing to explain.
        classroom={
          hasClassroom ? (
            // Wide: classrooms then everything by topic on the left, latest posts on the right. Phones: classrooms, latest posts, topics.
            <div className={`grid items-start gap-6 ${synced ? "lg:grid-cols-[1fr_24rem]" : ""}`}>
              <ClassroomPanel classes={classes} own={own} email={student.email} readOnly={readOnly} />
              {synced && (
                <>
                  <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
                    <Suspense fallback={loading("what's new in your class")}>
                      <ClassFeedSidebar result={feed} />
                    </Suspense>
                  </div>
                  <div className="grid gap-6 lg:col-start-1">
                    <Suspense fallback={null}>
                      <ClassTopics result={feed} />
                    </Suspense>
                  </div>
                </>
              )}
            </div>
          ) : null
        }
        progress={
          synced ? (
            <Suspense fallback={loading("your marks")}>
              <ProgressPanel result={feed} />
            </Suspense>
          ) : null
        }
      />
      {/* Phones: no room in the bar, so the follow link sits at the bottom. */}
      <div className="md:hidden">
        <LinkedInFollow variant="pill" />
      </div>
    </div>
  );
}
