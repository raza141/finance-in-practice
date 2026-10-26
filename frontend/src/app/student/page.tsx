import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";

import { Logo } from "@/core/components/layout/Logo";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { LinkedInFollow } from "@/core/components/ui/LinkedInFollow";
import { FinanceBackdrop } from "@/core/components/backdrop/FinanceBackdrop";
import { siteConfig } from "@/core/config/site";
import { signOutStudent } from "@/domains/students/actions/session";
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

const PERKS = [
  "Book, move or cancel sessions yourself",
  "Timed mock exams with your progress by topic",
  "See your progress against your target score",
];

export default async function StudentPage({ searchParams }: { searchParams: Promise<{ error?: string; view?: string }> }) {
  const [student, { error, view }] = await Promise.all([StudentAuth.current(), searchParams]);

  return (
    // -mt-20 cancels the layout's navbar padding: the portal brings its own bar.
    <div className="relative -mt-20 min-h-screen overflow-clip">
      {/* Grid pinned to the screen, like the bar's, so the frozen bar blends into the page. */}
      <FinanceBackdrop glow={false} className="fixed inset-0" />

      {/* The portal has its own bar instead of the marketing navbar (SiteChrome hides it here). */}
      {/* Frozen at the top while scrolling (the portal tabs stick just below it), in the page's own colour and grid. */}
      <header className="nav-line sticky top-0 z-30 bg-canvas bg-grid-lines bg-fixed">
        {/* A faint cyan-to-gold wash over the grid, so the bar reads as a bar. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-linear-to-r from-quant/10 via-transparent to-gold/10" />
        <div className="page-container relative flex h-16 items-center justify-between gap-4">
          <Link href="/" aria-label="Finance in Practice website">
            <Logo height={30} priority />
          </Link>
          {student ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="hidden md:block">
                <LinkedInFollow variant="pill" />
              </span>
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
            <JoinForm courses={courses} packages={packages} email={joining} />
          </>
        ) : register ? (
          <>
            <h1 className="text-3xl font-normal tracking-tight italic">Register</h1>
            {expired && <p className="text-sm text-gold">That sign-in expired. Please continue with Google again.</p>}
            <p className="text-muted">With Google, your portal opens straight away. With email, we first send you a link to confirm it.</p>
            {/* A plain link: the route redirects to Google, so no client JS is needed. */}
            <ButtonLink href="/api/student/auth/google" prefetch={false} variant="secondary" size="lg">
              Register with Google
            </ButtonLink>
            <p className="flex items-center gap-3 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">
              <span aria-hidden className="h-px flex-1 bg-line" />
              or with your email
              <span aria-hidden className="h-px flex-1 bg-line" />
            </p>
            <JoinForm courses={courses} packages={packages} />
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
            <p className="text-muted">Already studying with us? Sign in with Google, or by email if you registered without Google.</p>
            <ButtonLink href="/api/student/auth/google" prefetch={false} variant="secondary" size="lg">
              Continue with Google
            </ButtonLink>
            <EmailSignIn />
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
        {!joining && <LinkedInFollow variant="pill" className="justify-self-start" />}
      </div>
    </div>
  );
}
