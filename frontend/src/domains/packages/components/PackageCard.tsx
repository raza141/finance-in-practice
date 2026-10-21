import { PendingButton } from "@/domains/admin/components/PendingButton";
import { BUTTON } from "@/domains/students/components/buttons";

import { requestPackage } from "../actions/packages";
import { PackageTable } from "../services/PackageTable";
import type { Package } from "../types";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" });

/**
 * "Your package" above the portal tabs: what they're on, and a request to move
 * to another one. Nothing changes until the instructor applies it.
 */
export function PackageCard({
  current,
  requested,
  requestedAt,
  packages,
  readOnly,
}: {
  current: Package | null;
  requested: Package | null;
  requestedAt: string | null;
  packages: Package[];
  readOnly: boolean;
}) {
  const others = packages.filter((p) => p.id !== current?.id);
  return (
    <section aria-labelledby="package-title" className="grid gap-4 rounded-3xl border border-white/10 bg-canvas/70 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-center">
      <div>
        <h2 id="package-title" className="text-lg text-ink">
          {current ? `Your package: ${current.name}` : "Your package"}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {current
            ? PackageTable.isCustom(current)
              ? "Hours, pace and fee as agreed with your instructor."
              : `${PackageTable.hours(current)} for ${PackageTable.price(current)}. Your hours left are under Hours & payments.`
            : "No package yet. Ask for one below, or message your instructor."}
        </p>
        {requested && (
          <p role="status" className="mt-2 text-sm text-gold">
            You asked to move to {requested.name}
            {requestedAt && ` on ${DAY.format(new Date(requestedAt))}`}. Your instructor will confirm it.
          </p>
        )}
      </div>
      {!readOnly &&
        (requested ? (
          <form action={requestPackage}>
            <input type="hidden" name="package" value="none" />
            <PendingButton pendingLabel="Withdrawing…" className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
              Withdraw request
            </PendingButton>
          </form>
        ) : (
          others.length > 0 && (
            <form action={requestPackage} className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="package-change">
                Package to move to
              </label>
              <select id="package-change" name="package" required defaultValue="" className="h-10 rounded-md border border-line bg-canvas/80 px-3 text-sm text-ink">
                <option value="" disabled>
                  Change package
                </option>
                {others.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.hours ? `: ${PackageTable.hours(p)}, ${PackageTable.price(p)}` : ""}
                  </option>
                ))}
              </select>
              <PendingButton pendingLabel="Sending…" className={BUTTON}>
                Ask to change
              </PendingButton>
            </form>
          )
        ))}
    </section>
  );
}
