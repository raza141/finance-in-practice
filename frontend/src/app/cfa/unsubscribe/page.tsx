import type { Metadata } from "next";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { unsubscribeDaily } from "@/domains/questions/actions/questions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

/** From the daily question email. A button, not the link itself: mail scanners open links, and must not unsubscribe anyone. */
export default async function UnsubscribePage({ searchParams }: PageProps<"/cfa/unsubscribe">) {
  const { id, done } = await searchParams;
  return (
    <div className="page-container max-w-xl pt-16 pb-24">
      <h1 className="text-3xl font-black">Daily CFA question</h1>
      {done ? (
        <p role="status" className="mt-4 text-muted">
          You&rsquo;re unsubscribed. No more daily questions will be emailed to you.
        </p>
      ) : (
        <form action={unsubscribeDaily} className="mt-6">
          <input type="hidden" name="id" value={typeof id === "string" ? id : ""} />
          <p className="text-muted">Stop the daily question emails?</p>
          <PendingButton pendingLabel="Unsubscribing…" className="mt-4 h-11 rounded-md border border-line px-5 text-sm font-semibold text-ink hover:border-quant">
            Unsubscribe
          </PendingButton>
        </form>
      )}
    </div>
  );
}
