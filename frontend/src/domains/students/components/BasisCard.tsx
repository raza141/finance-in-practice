import { PendingButton } from "@/domains/admin/components/PendingButton";

import { requestBasis } from "../actions/account";
import { BillingBasis, type BasisState } from "../services/BillingBasis";
import type { BillingBasis as Basis, CoursePrices } from "../types";
import { BUTTON } from "./buttons";

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
const day = (iso: string) => DAY.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));

/**
 * "How you pay": hourly or monthly, each with its price, above every portal tab.
 * Switching is a request: monthly comes as an agreement to accept, hourly starts
 * when the current agreement month ends. Nothing changes billing until the owner answers.
 */
export function BasisCard({
  state,
  prices,
  requestedAt,
  readOnly,
}: {
  state: BasisState;
  prices: CoursePrices | null;
  requestedAt: string | null;
  readOnly: boolean;
}) {
  const { current, requested, monthEnds } = state;
  const status =
    requested === "month"
      ? "Your instructor will send you a monthly agreement to review and accept here. Until you accept it, you pay as now."
      : requested === "hour"
        ? monthEnds
          ? `Hourly starts after your agreement month ends on ${day(monthEnds)}.`
          : "Your instructor will confirm your hourly rate."
        : current === null
          ? "Choose how you'd like to pay. Your instructor confirms it."
          : null;

  const tile = (basis: Basis) => {
    const { amount, detail } = BillingBasis.price(basis, prices);
    const isCurrent = current === basis;
    const isRequested = requested === basis;
    const tone = isCurrent ? "border-quant/60 bg-quant/10" : isRequested ? "border-gold/50 bg-gold/5" : "border-line";
    return (
      <div key={basis} className={`grid content-between gap-3 rounded-2xl border p-4 ${tone}`}>
        <div>
          <p className="flex items-center justify-between gap-2 text-sm font-semibold text-ink">
            {BillingBasis.LABELS[basis]}
            {isCurrent && <span className="rounded-full bg-quant/20 px-2 py-0.5 text-xs font-normal text-quant">Your plan</span>}
            {isRequested && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs font-normal text-gold">Requested</span>}
          </p>
          <p className="mt-1 text-2xl tabular-nums text-ink">{amount}</p>
          <p className="text-sm text-muted">{detail}</p>
        </div>
        {!readOnly && !isCurrent && (
          <form action={requestBasis} className="flex flex-wrap items-center gap-3">
            <input type="hidden" name="basis" value={isRequested ? "none" : basis} />
            {isRequested && requestedAt && <span className="text-xs text-muted">Asked {day(requestedAt)}</span>}
            <PendingButton pendingLabel="Saving…" className={isRequested ? "text-xs text-muted underline-offset-2 hover:text-ink hover:underline" : BUTTON}>
              {isRequested ? "Withdraw request" : current ? `Switch to ${BillingBasis.LABELS[basis].toLowerCase()}` : `Choose ${BillingBasis.LABELS[basis].toLowerCase()}`}
            </PendingButton>
          </form>
        )}
      </div>
    );
  };

  return (
    <section aria-labelledby="basis-title" className="grid gap-4 rounded-3xl border border-white/10 bg-canvas/70 p-5 sm:p-6 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-center">
      <div>
        <h2 id="basis-title" className="text-lg text-ink">
          How you pay
        </h2>
        <p className="mt-1 text-sm text-muted">Hourly or monthly. You can switch at any time.</p>
        {status && (
          <p role="status" className="mt-3 text-sm text-ink/90">
            {status}
          </p>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{(["hour", "month"] as const).map(tile)}</div>
    </section>
  );
}
