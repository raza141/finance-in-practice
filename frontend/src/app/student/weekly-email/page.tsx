import type { Metadata } from "next";
import Link from "next/link";

import { stopWeeklyEmail } from "@/domains/classroom/actions/classroom";
import { PendingButton } from "@/domains/admin/components/PendingButton";

export const metadata: Metadata = { title: "Weekly email", robots: { index: false, follow: false } };

/**
 * From the link in the weekly email. A button, not an automatic switch-off on
 * opening: mail scanners open links before people do.
 */
export default async function WeeklyEmailPage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t, done } = await searchParams;
  return (
    <div className="page-container grid min-h-[60vh] place-items-center py-16">
      <div className="max-w-md rounded-3xl border border-white/10 bg-canvas/70 p-8 text-center">
        <h1 className="text-3xl font-normal italic">Weekly email</h1>
        {done ? (
          <p className="mt-4 text-muted">Done: you won&rsquo;t get the Sunday &ldquo;week in class&rdquo; email any more. Everything is still in your portal.</p>
        ) : (
          <>
            <p className="mt-4 text-muted">Stop the Sunday email with what&rsquo;s due, new and marked in your class?</p>
            <form action={stopWeeklyEmail} className="mt-6">
              <input type="hidden" name="t" value={t ?? ""} />
              <PendingButton pendingLabel="Stopping…" className="inline-flex h-11 items-center rounded-md bg-gold px-6 font-semibold text-canvas hover:bg-gold-bright">
                Stop weekly emails
              </PendingButton>
            </form>
          </>
        )}
        <Link href="/student" className="mt-6 inline-block text-sm text-quant hover:underline">
          Go to the student portal
        </Link>
      </div>
    </div>
  );
}
