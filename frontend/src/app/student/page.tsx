import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Logo } from "@/core/components/layout/Logo";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { FrontierBackdrop } from "@/core/components/ui/FrontierBackdrop";
import { siteConfig } from "@/core/config/site";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { signOutStudent } from "@/domains/students/actions/session";
import { ClassroomPanel } from "@/domains/students/components/ClassroomPanel";
import { JoinForm } from "@/domains/students/components/JoinForm";
import { StudentPortal } from "@/domains/students/components/StudentPortal";
import { StudyPlanTimeline } from "@/domains/students/components/StudyPlanTimeline";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { SignupTicket } from "@/domains/students/server/SignupTicket";
import { StudentAuth } from "@/domains/students/server/StudentAuth";
import { StudentRepository } from "@/domains/students/server/StudentRepository";
import { StudyPlanRepository } from "@/domains/students/server/StudyPlanRepository";
import { StudentSessions } from "@/domains/students/services/StudentSessions";
import type { Student, StudyPlanItem } from "@/domains/students/types";

export const metadata: Metadata = {
  title: "Student portal",
  description: "Enrolled students sign in to book, change or cancel 1-on-1 sessions and follow their study plan.",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  not_enrolled:
    "We couldn't find a student with that Google account. Please message us on WhatsApp.",
  google_cancelled: "Sign-in was cancelled.",
  google_state: "That sign-in link expired. Please try again.",
  google_failed: "Google sign-in didn't work. Please try again.",
  google_unavailable: "Student sign-in is not available right now. Please message us on WhatsApp.",
};

const REGISTER_STEPS = ["Continue with your Google account", "Add your mobile and course", "Your portal opens straight away"];

const PERKS = ["Book 1 to 4 hour sessions in your own time", "Change or cancel a session in two clicks", "Follow your study plan and open your materials"];

/** Each source fails on its own: a Cal.com or database hiccup never takes the whole portal down. */
async function safely<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load();
  } catch (error) {
    console.error(`student: could not load ${label}`, error);
    return null;
  }
}

async function portalData(student: Student) {
  const classrooms = ClassroomRepository.fromEnv();
  const [courses, bookings, plan, classes, own] = await Promise.all([
    safely("courses", async () => (await StudentRepository.fromEnv()?.bookableCourses(student)) ?? student.courses),
    safely("sessions", async (): Promise<CalBookingDetail[]> =>
      (await CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug)?.bookingsFor(student.email)) ?? [],
    ),
    safely("study plan", async (): Promise<StudyPlanItem[]> => (await StudyPlanRepository.fromEnv()?.forClient(student.id)) ?? []),
    safely("classrooms", async () => (await classrooms?.forClient(student.id, student.courses)) ?? []),
    safely("private classrooms", async () => (await classrooms?.privateFor(student.id)) ?? []),
  ]);
  return {
    courses: courses ?? student.courses,
    sessions: bookings && StudentSessions.upcoming(bookings),
    past: bookings ? StudentSessions.past(bookings) : [],
    addresses: bookings ? StudentSessions.addresses(bookings) : [],
    plan,
    classes: classes ?? [],
    own: own ?? [],
  };
}

export default async function StudentPage({ searchParams }: { searchParams: Promise<{ error?: string; view?: string }> }) {
  const [student, { error, view }] = await Promise.all([StudentAuth.current(), searchParams]);

  return (
    // -mt-20 cancels the layout's navbar padding: the portal brings its own bar.
    <div className="relative -mt-20 min-h-screen overflow-clip">
      <FrontierBackdrop className="absolute inset-0" />

      {/* The portal has its own bar instead of the marketing navbar (SiteChrome hides it here). */}
      {/* Frozen at the top while scrolling (the portal tabs stick just below it). */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-canvas/25 backdrop-blur-md">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Finance in Practice website">
            <Logo height={30} priority />
          </Link>
          {student ? (
            <div className="flex items-center gap-3 text-sm">
              <span aria-hidden className="grid h-8 w-8 place-items-center rounded-full bg-quant/15 text-xs font-semibold text-quant">
                {initialsOf(student.name)}
              </span>
              <span className="hidden max-w-48 truncate text-ink sm:inline">{student.name}</span>
              <form action={signOutStudent}>
                <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-muted hover:border-red-300/50 hover:text-red-300">
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <span className="font-mono text-[11px] tracking-[0.25em] text-quant uppercase">Student portal</span>
          )}
        </div>
      </header>

      <div className="page-container relative py-8 lg:py-10">
        {student ? (
          <Portal student={student} />
        ) : (
          // Signed out: the card sits in the middle of the screen (viewport minus the 4rem bar and the page padding).
          <div className="grid min-h-[calc(100svh-4rem-5rem)] content-center">
            <SignIn error={error} view={view} />
          </div>
        )}
      </div>
    </div>
  );
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

async function Portal({ student }: { student: Student }) {
  const { courses, sessions, past, addresses, plan, classes, own } = await portalData(student);
  const first = student.name.split(/\s+/)[0];

  return (
    <div className="grid gap-6">
      <section aria-labelledby="welcome-heading" className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 id="welcome-heading" className="text-3xl font-normal italic sm:text-4xl">
            Hi {first}, welcome back
          </h1>
          <p className="mt-1 text-sm text-muted">{student.email}</p>
        </div>
        {student.courses.length > 0 && (
          <ul aria-label="Your programmes" className="flex flex-wrap gap-2">
            {student.courses.map((c) => (
              <li key={c} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-ink">
                {c}
              </li>
            ))}
          </ul>
        )}
      </section>
      <StudentPortal
        courses={courses}
        lengths={siteConfig.studentBooking.lengths}
        sessions={sessions}
        past={past}
        addresses={addresses}
        plan={<StudyPlanTimeline items={plan} programmes={student.courses} />}
        // No Classroom yet (e.g. a single session): no tab, nothing to explain.
        classroom={classes.length + own.length > 0 ? <ClassroomPanel classes={classes} own={own} email={student.email} /> : null}
      />
    </div>
  );
}

/** Published courses only: the public form never lists drafts or internal programmes. */
async function publicCourses(): Promise<string[]> {
  return (await safely("published courses", async () => (await CourseRepository.fromEnv()?.active())?.map((c) => c.title) ?? [])) ?? [];
}

async function SignIn({ error, view }: { error?: string; view?: string }) {
  // "join": back from Google with a verified email that isn't a student yet.
  const joining = view === "join" ? (SignupTicket.fromEnv()?.read((await cookies()).get(SignupTicket.COOKIE)?.value) ?? null) : null;
  // Back on the join view without a valid ticket: it expired (or was used).
  const expired = view === "join" && joining === null;
  const register = joining !== null || view === "register" || view === "join";
  const courses = joining ? await publicCourses() : [];
  const tab = (active: boolean) =>
    `flex-1 rounded-md px-3 py-2 text-center text-sm transition-colors ${active ? "bg-quant/15 font-semibold text-quant" : "text-muted hover:text-ink"}`;
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-canvas/40 backdrop-blur-[2px] md:grid-cols-2">
      <div className="relative flex flex-col justify-start gap-10 border-b border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgb(34_211_238/0.18),transparent_60%)] p-8 sm:p-10 md:border-r md:border-b-0">
        <Logo height={44} />
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Student portal</p>
          <p className="mt-4 text-3xl leading-tight font-normal italic sm:text-4xl">Your sessions and study plan, in one place.</p>
          <ul className="mt-6 grid gap-3 text-sm text-ink/90">
            {PERKS.map((perk) => (
              <li key={perk} className="flex gap-2.5">
                <span aria-hidden className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-gold text-[10px] text-canvas">
                  ✓
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid content-start gap-5 p-8 sm:p-10">
        <nav aria-label="Sign in or register" className="flex gap-1 rounded-lg border border-line p-1">
          <Link href="/student" aria-current={!register ? "page" : undefined} className={tab(!register)}>
            Sign in
          </Link>
          <Link href="/student?view=register" aria-current={register ? "page" : undefined} className={tab(register)}>
            Register
          </Link>
        </nav>
        {error && ERRORS[error] && (
          <p role="alert" className="text-sm text-gold">
            {ERRORS[error]}
          </p>
        )}
        {joining ? (
          <>
            <h1 className="text-3xl font-normal tracking-tight italic">Almost there</h1>
            <p className="text-muted">Google confirmed your email. Add your details and pick what you&rsquo;d like to study: your portal opens straight away.</p>
            <JoinForm courses={courses} email={joining} />
          </>
        ) : register ? (
          <>
            <h1 className="text-3xl font-normal tracking-tight italic">Register</h1>
            {expired && <p className="text-sm text-gold">That sign-in expired. Please continue with Google again.</p>}
            <ol className="grid gap-2 text-sm text-ink/90">
              {REGISTER_STEPS.map((step, i) => (
                <li key={step} className="flex gap-2.5">
                  <span aria-hidden className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold text-[11px] font-bold text-canvas">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
            {/* A plain link: the route redirects to Google, so no client JS is needed. */}
            <ButtonLink href="/api/student/auth/google" prefetch={false} variant="secondary" size="lg">
              Register with Google
            </ButtonLink>
            <p className="border-t border-line pt-5 text-sm text-muted">
              Already registered?{" "}
              <Link href="/student" className="text-quant hover:underline">
                Sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <h1 className="text-3xl font-normal tracking-tight italic">Sign in</h1>
            <p className="text-muted">Already studying with us? Sign in with your Google account.</p>
            <ButtonLink href="/api/student/auth/google" prefetch={false} variant="secondary" size="lg">
              Continue with Google
            </ButtonLink>
            <p className="border-t border-line pt-5 text-sm text-muted">
              New here?{" "}
              <Link href="/student?view=register" className="font-semibold text-gold hover:underline">
                Register
              </Link>{" "}
              or{" "}
              <Link href={siteConfig.bookingHref} className="text-quant hover:underline">
                book the free diagnostic
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
