import type { Metadata } from "next";
import Link from "next/link";

import { CosmicBackdrop } from "@/core/components/3d/CosmicBackdrop";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { siteConfig } from "@/core/config/site";
import { signOutStudent } from "@/domains/students/actions/session";
import { StudentBookingForm } from "@/domains/students/components/StudentBookingForm";
import { StudentDashboard } from "@/domains/students/components/StudentDashboard";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = {
  title: "Student sign-in",
  description: "Enrolled students sign in to book their next 1-on-1 session.",
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

export default async function StudentPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [student, { error }] = await Promise.all([StudentAuth.current(), searchParams]);
  const { whatsapp } = siteConfig.contact;
  const whatsappHref = `https://wa.me/${whatsapp.number}?text=${encodeURIComponent("Hi! I'm a student and I'd like to book a session.")}`;

  return (
    <section aria-labelledby="student-heading" className="relative -mt-20 overflow-hidden">
      <CosmicBackdrop className="absolute inset-0" tilt={0.6} zoom={7.5} />
      <div className="page-container relative grid max-w-3xl gap-8 pt-28 pb-16 lg:pt-32">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-quant uppercase">Students</p>
          <h1 id="student-heading" className="mt-5 text-5xl leading-[1.05] font-normal tracking-tight italic sm:text-6xl">
            {student ? `Hi ${student.name.split(" ")[0]}, book your next session` : "Book your next session"}
          </h1>
          {!student && (
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              Already studying with us? Sign in with the Google account we have on file to pick a time for your 1-on-1
              session.
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-white/10 bg-canvas/60 p-6 backdrop-blur-md sm:p-8">
          {student ? (
            <>
              <StudentBookingForm courses={student.courses} minutes={siteConfig.studentBooking.minutes} />
              <form action={signOutStudent} className="mt-6 border-t border-line pt-4 text-sm text-muted">
                Signed in as {student.email} ·{" "}
                <button type="submit" className="text-quant hover:underline">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <div className="grid gap-5">
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
          )}
        </div>
        {student && <StudentDashboard student={student} />}
      </div>
    </section>
  );
}
