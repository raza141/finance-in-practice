import { Suspense } from "react";

import { siteConfig } from "@/core/config/site";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { ClassFeedSidebar, ClassTopics, LatestMockCard, OverviewClassCards, ProgressPanel, type FeedResult } from "@/domains/classroom/components/ClassroomViews";
import { ClassroomSync } from "@/domains/classroom/server/ClassroomSync";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { PackageCard } from "@/domains/packages/components/PackageCard";
import { PackageRepository } from "@/domains/packages/server/PackageRepository";
import { MockLobby, TopicDrill } from "@/domains/mocks/components/MockLobby";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockProgress } from "@/domains/mocks/services/MockProgress";

import { ClassroomRepository } from "../server/ClassroomRepository";
import { TermsRepository } from "@/domains/settings/server/TermsRepository";

import { acceptTerms } from "../actions/account";
import { HourRequestRepository } from "../server/HourRequestRepository";
import { SessionLogRepository } from "../server/SessionLogRepository";
import { SessionRequestRepository } from "@/domains/students/server/SessionRequestRepository";
import { StudentRepository } from "../server/StudentRepository";
import { StudyPlanRepository } from "../server/StudyPlanRepository";
import { StudentAccount } from "../services/StudentAccount";
import { StudentSessions } from "../services/StudentSessions";
import { StudyDays } from "../services/StudyDays";
import type { Student, StudentAccountView, StudyPlanItem } from "../types";
import { AccountPanel, AccountSummaryCard } from "./AccountPanel";
import { BOOK_BUTTON } from "./buttons";
import { ClassroomPanel } from "./ClassroomPanel";
import { PortalOverview } from "./PortalOverview";
import { CardSkeleton } from "./PortalSkeleton";
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
  const [courses, booked, plan, classes, own, entries, documents, client, agreements, log, requests, termsAccepted, offers, pkg, packages, mocks, attempts, marks, exam, bank] = await Promise.all([
    safely("courses", async () => (await StudentRepository.fromEnv()?.bookableCourses(student)) ?? student.courses),
    safely("sessions", async (): Promise<CalBookingDetail[]> => {
      const [booked, waiting] = await Promise.all([
        CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug)?.bookingsFor(student.email) ?? [],
        SessionRequestRepository.fromEnv()?.waiting(student.id) ?? [],
      ]);
      return SessionRequestRepository.merge(booked, waiting);
    }),
    safely("study plan", async (): Promise<StudyPlanItem[]> => (await StudyPlanRepository.fromEnv()?.forClient(student.id)) ?? []),
    safely("classrooms", async () => (await classrooms?.forClient(student.id, student.courses)) ?? []),
    safely("private classrooms", async () => (await classrooms?.privateFor(student.id)) ?? []),
    // Billing reads only this student's own client id, from their session.
    safely("account", async () => (invoices ? invoices.ledger(student.id) : null)),
    safely("documents", async () => (invoices ? invoices.forClient(student.id) : null)),
    safely("plan", async () => (await ClientRepository.fromEnv()?.byId(student.id)) ?? null),
    safely("agreements", async () => (await AgreementRepository.fromEnv()?.forClient(student.id)) ?? []),
    safely("session log", async () => (await SessionLogRepository.fromEnv()?.forClient(student.id)) ?? []),
    safely("hour requests", async () => (await HourRequestRepository.fromEnv()?.forClient(student.id)) ?? []),
    safely("terms", async () => (await TermsRepository.fromEnv()?.acceptedCurrent(student.id)) ?? true),
    safely("open quotes", async () => (invoices ? invoices.openQuotes(student.id) : [])),
    safely("package", async () => (await PackageRepository.fromEnv()?.ofClient(student.id)) ?? null),
    safely("packages", async () => (await PackageRepository.fromEnv()?.active()) ?? []),
    safely("mock exams", async () => (await MockRepository.fromEnv()?.published(student.id)) ?? []),
    safely("mock attempts", async () => (await MockRepository.fromEnv()?.history(student.id)) ?? []),
    safely("mock marks", async () => (await MockRepository.fromEnv()?.topicMarks(student.id)) ?? []),
    safely("next exam", async () => (await StudyPlanRepository.fromEnv()?.nextExam(student.id)) ?? null),
    safely("bank topics", async () => [...new Set(((await MockRepository.fromEnv()?.topicLevels()) ?? []).map((t) => t.topic))]),
  ]);
  // The owner's corrections (real length, didn't happen) apply everywhere: past sessions and the account.
  const bookings = booked && StudentSessions.applyLog(booked, log ?? []);
  // No ledger: the money can't be shown, so no account (rather than "all paid").
  const account: StudentAccountView | null = entries
    ? StudentAccount.build({
        entries,
        documents,
        bookings,
        agreements: agreements ?? [],
        requests: requests ?? [],
        manual: (log ?? []).flatMap((l) => (l.onDate ? [{ date: l.onDate, minutes: l.minutes }] : [])),
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
    exam: exam ?? null,
    bankTopics: bank ?? [],
    classes: classes ?? [],
    own: own ?? [],
    account,
    // Unknown (database hiccup): don't nag.
    termsAccepted: termsAccepted ?? true,
    offers: offers ?? [],
    // Unknown (database hiccup): no card rather than a wrong one.
    pkg: pkg && { ...pkg, packages: packages ?? [] },
    mocks,
    attempts,
    // Unknown (database hiccup): no card and no tab rather than an empty record.
    progress: marks && MockProgress.build(marks),
  };
}

/** The signed-in student's portal; `readOnly`: an admin viewing it as them (nothing can be booked, changed or marked seen). */
export async function Portal({ student, readOnly = false }: { student: Student; readOnly?: boolean }) {
  const { courses, sessions, past, addresses, plan, exam, bankTopics, classes, own, account, termsAccepted, offers, pkg, mocks, attempts, progress } = await portalData(student);
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
  const loading = (label: string) => <CardSkeleton label={label} />;
  const today = StudyDays.today();
  const hasMocks = mocks === null || attempts === null || mocks.length + attempts.length > 0;

  const notices = (
    <>
      {student.ended.length > 0 && (
        <section role="status" className="rounded-3xl border border-line bg-surface p-5 text-sm text-muted">
          {student.ended.map((e) => (
            <p key={e.course}>
              Your portal access for <span className="text-ink">{e.course}</span> ({e.label}) ended on {e.ends}. Your past mock results stay here to look back on.
            </p>
          ))}
          <p className="mt-2">Sitting the exam again or moving to the next level? Contact us and we&rsquo;ll open your new batch.</p>
        </section>
      )}
      {!termsAccepted && (
        <section role="status" className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-gold/40 bg-surface-raised p-5 text-sm">
          <p className="text-ink">
            Please review our{" "}
            <a href="/terms" target="_blank" rel="noreferrer" className="text-quant underline-offset-2 hover:underline">
              terms and conditions
            </a>{" "}
            and accept them to keep booking.
          </p>
          {!readOnly && (
            <form action={acceptTerms}>
              <button type="submit" className={BOOK_BUTTON}>
                I accept the terms
              </button>
            </form>
          )}
        </section>
      )}
    </>
  );

  return (
      <StudentPortal
        readOnly={readOnly}
        me={{ name: student.name, email: student.email }}
        notices={notices}
        // In the Me menu under Hours & payments, not above every tab.
        pkg={pkg && <PackageCard current={pkg.current} requested={pkg.requested} requestedAt={pkg.requestedAt} packages={pkg.packages} readOnly={readOnly} />}
        badges={{
          sessions: (sessions ?? []).filter((s) => s.status === "pending").length,
          plan: (plan ?? []).filter((p) => StudyDays.overdue(p, today)).length,
        }}
        name={student.name.split(" ")[0]}
        courses={courses}
        lengths={siteConfig.studentBooking.lengths}
        sessions={sessions}
        past={past}
        addresses={addresses}
        plan={<StudyPlanTimeline items={plan} programmes={student.courses} exam={exam} sessions={[...past, ...(sessions ?? [])]} attempts={attempts ?? []} bankTopics={bankTopics} readOnly={readOnly} />}
        mocks={hasMocks ? <MockLobby mocks={mocks} history={attempts} readOnly={readOnly} /> : null}
        progress={progress && progress.mocks.length > 0 ? <ProgressPanel progress={progress} /> : null}
        drill={attempts?.some((a) => a.status === "completed") ? <TopicDrill readOnly={readOnly} /> : null}
        account={<AccountPanel account={account} offers={offers} readOnly={readOnly} />}
        overview={
          <PortalOverview
            sessions={sessions}
            plan={plan}
            accountCard={<AccountSummaryCard account={account} />}
            mockCard={progress && (progress.mocks.length > 0 || (mocks?.length ?? 0) > 0) ? <LatestMockCard progress={progress} /> : null}
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
      />
  );
}
