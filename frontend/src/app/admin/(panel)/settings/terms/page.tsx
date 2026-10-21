import type { Metadata } from "next";
import Link from "next/link";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { publishTerms } from "@/domains/settings/actions/terms";
import { TermsRepository } from "@/domains/settings/server/TermsRepository";
import { TermsText } from "@/domains/settings/services/TermsText";

export const metadata: Metadata = { title: "Terms and conditions" };

const WHEN = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });

/** Edit and publish the terms page; every publish is a new version students accept. */
export default async function TermsSettingsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await AdminAuth.requireOwner();
  const [latest, query] = await Promise.all([TermsRepository.fromEnv()?.latest() ?? null, searchParams]);
  const error = typeof query.error === "string" ? query.error : null;
  return (
    <div className="max-w-4xl">
      <Link href="/admin/settings" className="text-sm text-muted hover:text-ink">
        ← Settings
      </Link>
      <h1 className="mt-3 text-3xl font-normal tracking-tight italic">Terms and conditions</h1>
      <p className="mt-2 text-sm text-muted">
        {latest ? `Live version published ${WHEN.format(latest.createdAt)}.` : "Nothing published yet: /terms shows the built-in text, and this draft starts from it (plus a section on monthly agreements)."}{" "}
        Publishing makes a new version: /terms shows it straight away, and every student accepts it in their portal before their next booking.
      </p>
      {query.notice === "published" && <p role="status" className="mt-4 text-sm text-quant">Published. Students are asked to accept it on their next visit.</p>}
      {query.notice === "unchanged" && <p role="status" className="mt-4 text-sm text-muted">No changes: nothing was published.</p>}
      {error && <p role="alert" className="mt-4 text-sm text-gold">Not published: {error}</p>}
      <form action={publishTerms} className="mt-6 grid gap-3">
        <label className="text-xs text-muted">
          One section per &ldquo;## Heading&rdquo; line. A blank line starts a new paragraph; lines starting with &ldquo;- &rdquo; make a list.
          <textarea name="body" required rows={28} maxLength={TermsText.LIMITS.max} defaultValue={latest?.body ?? TermsText.draft()} className={`${FIELD} mt-1 font-mono text-xs leading-relaxed`} />
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <PendingButton pendingLabel="Publishing…" className="h-10 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant hover:bg-quant/25">
            Publish new version
          </PendingButton>
          <Link href="/terms" target="_blank" className="text-sm text-muted hover:text-ink">
            Open /terms
          </Link>
        </div>
      </form>
    </div>
  );
}
