import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Logo } from "@/core/components/layout/Logo";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { GoogleGlyph } from "@/core/components/ui/GoogleGlyph";
import { FinanceBackdrop } from "@/core/components/backdrop/FinanceBackdrop";
import { EmailSignIn, JoinForm } from "@/domains/students/components/JoinForm";
import { Portal, safely } from "@/domains/students/components/PortalView";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { SignupTicket } from "@/domains/students/server/SignupTicket";
import type { Package, PricingCourse } from "@/domains/packages/types";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

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
  link_expired: "That email link has expired. Please ask for a new one.",
  link_failed: "That email link didn't work. Please try again.",
};


export default async function StudentPage({ searchParams }: { searchParams: Promise<{ error?: string; view?: string }> }) {
  const [student, { error, view }] = await Promise.all([StudentAuth.current(), searchParams]);

  return (
    // -mt-20 cancels the layout's navbar padding: the portal brings its own bar.
    <div className="relative -mt-20 min-h-screen overflow-clip">
      {/* Grid pinned to the screen, like the bar's, so the frozen bar blends into the page. */}
      <FinanceBackdrop glow={false} className="fixed inset-0" />

      {/* The portal has its own bar instead of the marketing navbar (SiteChrome hides it here); signed in, the portal brings it with its tabs. */}
      {student ? (
        <Portal student={student} />
      ) : (
        <>
          <header className="nav-line sticky top-0 z-30 bg-canvas bg-grid-lines bg-fixed">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-r from-quant/5 via-transparent to-gold/5" />
            <div className="page-container relative flex h-16 items-center gap-4">
              <Link href="/" aria-label="Finance in Practice website">
                <Logo height={30} priority />
              </Link>
            </div>
          </header>
          {/* Signed out: the card sits in the middle of the screen (viewport minus the 4rem bar and the page padding). */}
          <div className="page-container relative grid min-h-[calc(100svh-4rem-5rem)] content-center py-8 lg:py-10">
            <SignIn error={error} view={view} />
          </div>
        </>
      )}
    </div>
  );
}


/** Published courses only (the public form never lists drafts or internal programmes), with exam sittings, and the live packages. */
async function publicOptions(): Promise<{ courses: PricingCourse[]; packages: Package[] }> {
  return (await safely("published courses", async () => ClassroomRepository.fromEnv()?.registrationOptions())) ?? { courses: [], packages: [] };
}

async function SignIn({ error, view }: { error?: string; view?: string }) {
  // "join": back from Google with a verified email that isn't a student yet.
  const joining = view === "join" ? (SignupTicket.fromEnv()?.read((await cookies()).get(SignupTicket.COOKIE)?.value) ?? null) : null;
  // Back on the join view without a valid ticket: it expired (or was used).
  const expired = view === "join" && joining === null;
  const register = joining !== null || view === "register" || view === "join";
  const { courses, packages } = register ? await publicOptions() : { courses: [], packages: [] };
  const tab = (active: boolean) =>
    `flex-1 rounded-btn px-3 py-2 text-center text-sm font-semibold transition-colors duration-200 ${active ? "bg-gold text-canvas" : "text-muted hover:text-ink"}`;
  const alert = (error && ERRORS[error]) || (expired ? "That sign-in expired. Please continue with Google again." : null);
  return (
    // Glass card over the moving finance backdrop: the blur is what makes it read as glass.
    <div className="mx-auto grid w-full max-w-md gap-6 rounded-3xl border border-ink/10 bg-canvas/55 p-7 shadow-2xl shadow-canvas/60 backdrop-blur-xl sm:p-10">
      <h1 className="text-center text-3xl font-normal tracking-tight italic">{joining ? "Almost there" : register ? "Create your account" : "Welcome back"}</h1>
      {!joining && (
        <nav aria-label="Sign in or register" className="flex gap-1 rounded-btn border border-ink/10 bg-canvas/40 p-1">
          <Link href="/student" aria-current={!register ? "page" : undefined} className={tab(!register)}>
            Sign in
          </Link>
          <Link href="/student?view=register" aria-current={register ? "page" : undefined} className={tab(register)}>
            Register
          </Link>
        </nav>
      )}
      {alert && (
        <p role="alert" className="text-center text-sm text-red-300">
          {alert}
        </p>
      )}
      {joining ? (
        <JoinForm courses={courses} packages={packages} email={joining} />
      ) : (
        <>
          {/* A plain link: the route redirects to Google, so no client JS is needed. */}
          <ButtonLink href="/api/student/auth/google" prefetch={false} variant="secondary" size="lg" className="w-full">
            <GoogleGlyph size={18} />
            {register ? "Register with Google" : "Continue with Google"}
          </ButtonLink>
          <p className="flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
            <span aria-hidden className="h-px flex-1 bg-ink/10" />
            or
            <span aria-hidden className="h-px flex-1 bg-ink/10" />
          </p>
          {register ? <JoinForm courses={courses} packages={packages} /> : <EmailSignIn />}
        </>
      )}
    </div>
  );
}
