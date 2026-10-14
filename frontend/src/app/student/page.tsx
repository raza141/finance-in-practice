import type { Metadata } from "next";
import Link from "next/link";

import { CosmicBackdrop } from "@/core/components/3d/CosmicBackdrop";
import { Logo } from "@/core/components/layout/Logo";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { signOutStudent } from "@/domains/students/actions/session";
import { StudentPortal } from "@/domains/students/components/StudentPortal";
import { StudyPlanTimeline } from "@/domains/students/components/StudyPlanTimeline";
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
    "We couldn't find a student with that Google account. Use the email we have on file, or message us on WhatsApp. New here? Start with the free diagnostic.",
  google_cancelled: "Sign-in was cancelled.",
  google_state: "That sign-in link expired. Please try again.",
  google_failed: "Google sign-in didn't work. Please try again.",
  google_unavailable: "Student sign-in is not available right now. Please message us on WhatsApp.",
};

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
  const [courses, bookings, plan] = await Promise.all([
    safely("courses", async () => (await StudentRepository.fromEnv()?.bookableCourses(student)) ?? student.courses),
    safely("sessions", async (): Promise<CalBookingDetail[]> =>
      (await CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug)?.bookingsFor(student.email)) ?? [],
    ),
    safely("study plan", async (): Promise<StudyPlanItem[]> => (await StudyPlanRepository.fromEnv()?.forClient(student.id)) ?? []),
  ]);
  return {
    courses: courses ?? student.courses,
    sessions: bookings && StudentSessions.upcoming(bookings),
    addresses: bookings ? StudentSessions.addresses(bookings) : [],
    plan,
  };
}

export default async function StudentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [student, { error }] = await Promise.all([StudentAuth.current(), searchParams]);
  const { whatsapp } = siteConfig.contact;
  const whatsappHref = `https://wa.me/${whatsapp.number}?text=${encodeURIComponent("Hi! I'm a student and I'd like to book a session.")}`;

  return (
    // -mt-20 cancels the layout's navbar padding: the portal brings its own bar.
    <div className="relative -mt-20 min-h-screen overflow-hidden">
      <CosmicBackdrop className="absolute inset-0" tilt={0.6} zoom={7.5} />

      {/* The portal has its own bar instead of the marketing navbar (SiteChrome hides it here). */}
      <header className="relative border-b border-white/5 bg-canvas/70 backdrop-blur-md">
        <div className="page-container flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Finance in Practice home">
            <Logo height={30} priority />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden font-mono text-[11px] tracking-[0.25em] text-quant uppercase sm:inline">Student portal</span>
            <Link href="/" className="text-muted hover:text-ink">
              ← Website
            </Link>
          </div>
        </div>
      </header>

      <div className="page-container relative py-10 lg:py-14">
        {student ? <Portal student={student} /> : <SignIn error={error} whatsappHref={whatsappHref} />}
      </div>
    </div>
  );
}

async function Portal({ student }: { student: Student }) {
  const { courses, sessions, addresses, plan } = await portalData(student);
  const first = student.name.split(/\s+/)[0];
  const initials = student.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  const welcome = (
    <section aria-labelledby="welcome-heading" className="rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <span aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-quant/15 font-semibold text-quant">
          {initials}
        </span>
        <div className="min-w-0">
          <h1 id="welcome-heading" className="text-2xl font-normal italic">
            Hi {first}, welcome back
          </h1>
          <p className="truncate text-sm text-muted">{student.email}</p>
        </div>
      </div>
      {student.courses.length > 0 && (
        <ul aria-label="Your programmes" className="mt-4 flex flex-wrap gap-2">
          {student.courses.map((c) => (
            <li key={c} className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-semibold text-ink">
              {c}
            </li>
          ))}
        </ul>
      )}
      <form action={signOutStudent} className="mt-5 border-t border-line pt-4">
        <button type="submit" className="rounded-md border border-line px-3 py-1.5 text-sm text-muted hover:border-red-300/50 hover:text-red-300">
          Sign out
        </button>
      </form>
    </section>
  );

  return (
    <div className="grid gap-6">
      <StudentPortal welcome={welcome} courses={courses} lengths={siteConfig.studentBooking.lengths} sessions={sessions} addresses={addresses} />
      <StudyPlanTimeline items={plan} />
    </div>
  );
}

function SignIn({ error, whatsappHref }: { error?: string; whatsappHref: string }) {
  return (
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 bg-canvas/70 backdrop-blur-md md:grid-cols-2">
      <div className="relative flex flex-col justify-between gap-10 border-b border-white/10 bg-[radial-gradient(circle_at_20%_20%,rgb(34_211_238/0.18),transparent_60%)] p-8 sm:p-10 md:border-r md:border-b-0">
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

      <div className="grid content-center gap-5 p-8 sm:p-10">
        <h1 className="text-3xl font-normal tracking-tight italic">Sign in</h1>
        <p className="text-muted">Already studying with us? Use the Google account we have on file.</p>
        {error && ERRORS[error] && (
          <p role="alert" className="text-sm text-gold">
            {ERRORS[error]}
          </p>
        )}
        {/* A plain link: the route redirects to Google, so no client JS is needed. */}
        <ButtonLink href="/api/student/auth/google" prefetch={false} variant="secondary" size="lg">
          Continue with Google
        </ButtonLink>
        <p className="text-sm text-muted">
          No Google account?{" "}
          <Link href={whatsappHref} target="_blank" rel="noreferrer" className="text-quant hover:underline">
            Message us on WhatsApp
          </Link>{" "}
          and we&rsquo;ll book it for you.
        </p>
        <p className="border-t border-line pt-5 text-sm text-muted">
          New to Finance in Practice?{" "}
          <Link href={siteConfig.bookingHref} className="text-gold hover:underline">
            Book the free diagnostic
          </Link>
        </p>
      </div>
    </div>
  );
}
