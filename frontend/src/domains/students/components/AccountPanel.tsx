import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import type { ClientDocument, Currency } from "@/domains/invoices/types";

import type { AccountAgreement, AccountMoney, AccountMonth, StudentAccountView, StudentPlan } from "../types";
import { BOOK_BUTTON, BUTTON } from "./buttons";
import { TabButton } from "./StudentPortal";

const CARD = "rounded-3xl border border-white/10 bg-canvas/70 p-6 backdrop-blur-md";
const LABEL = "text-sm text-muted";
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });
const MONTH_LONG = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const monthDate = (ym: string) => new Date(`${ym}-01T00:00:00Z`);

/** "1.5 h"; "0 h" stays plain. */
export const hoursOf = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} h`;
const amounts = (list: { currency: Currency; minor: number }[]) => (list.length ? list.map((x) => InvoiceMath.money(x.minor, x.currency)).join(" + ") : "–");

const PER: Record<StudentPlan["unit"], string> = {
  month: "a month",
  hour: "an hour",
  session: "a session",
  package: "a package",
  milestone: "a milestone",
  fee: "fixed fee",
};
const DOC: Record<ClientDocument["docType"], string> = { invoice: "Invoice", receipt: "Receipt", credit_note: "Credit note" };

/** "AED 300.00 to pay", "All paid", "AED 50.00 in credit". */
function balanceText(money: AccountMoney): { text: string; tone: string } {
  if (money.balanceMinor > 0) return { text: `${InvoiceMath.money(money.balanceMinor, money.currency)} to pay`, tone: "text-gold" };
  if (money.balanceMinor < 0) return { text: `${InvoiceMath.money(-money.balanceMinor, money.currency)} in credit`, tone: "text-quant" };
  return { text: "All paid", tone: "text-quant" };
}

/** The Overview card: hours this month and what is owed. */
export function AccountSummaryCard({ account }: { account: StudentAccountView | null }) {
  const now = account?.months.at(-2);
  return (
    <section className={CARD}>
      <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Hours &amp; payments</h2>
      {account && now ? (
        <>
          <p className="mt-2 text-xl font-semibold text-ink">
            {account.taken ? `${hoursOf(now.minutesTaken)} studied in ${MONTH.format(monthDate(now.month))}` : "Hours unavailable just now"}
          </p>
          <p className="text-sm text-muted">
            {account.money.length === 0
              ? "No invoices yet"
              : account.money.map((m) => {
                  const { text, tone } = balanceText(m);
                  return (
                    <span key={m.currency} className={`mr-3 ${tone}`}>
                      {text}
                    </span>
                  );
                })}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">Couldn&rsquo;t load your account just now.</p>
      )}
      <TabButton tab="account" className={`${BUTTON} mt-4`}>
        Open account
      </TabButton>
    </section>
  );
}

/**
 * The portal's Account tab: what they owe, hours studied, what is left of
 * hours paid up front, a month-by-month record and a look at next month.
 */
export function AccountPanel({ account }: { account: StudentAccountView | null }) {
  if (!account) {
    return <p className={`${CARD} text-sm text-muted`}>Couldn&rsquo;t load your account right now. Please refresh in a minute.</p>;
  }
  const { money, taken, prepaid, plan, next, months, documents, agreements } = account;
  return (
    <div className="grid gap-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <section className={CARD} aria-labelledby="balance-heading">
          <h2 id="balance-heading" className={LABEL}>
            Balance
          </h2>
          {money.length === 0 ? (
            <p className="mt-2 text-2xl font-semibold text-ink">No invoices yet</p>
          ) : (
            money.map((m) => {
              const { text, tone } = balanceText(m);
              return (
                <div key={m.currency} className="mt-2">
                  <p className={`text-3xl font-semibold tabular-nums ${tone}`}>{text}</p>
                  <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm tabular-nums">
                    <dt className="text-muted">Invoiced</dt>
                    <dd className="text-right text-ink">{InvoiceMath.money(m.chargedMinor, m.currency)}</dd>
                    <dt className="text-muted">Paid</dt>
                    <dd className="text-right text-ink">{InvoiceMath.money(m.paidMinor, m.currency)}</dd>
                    {m.creditedMinor > 0 && (
                      <>
                        <dt className="text-muted">Credited back</dt>
                        <dd className="text-right text-ink">{InvoiceMath.money(m.creditedMinor, m.currency)}</dd>
                      </>
                    )}
                  </dl>
                </div>
              );
            })
          )}
        </section>

        <section className={CARD} aria-labelledby="studied-heading">
          <h2 id="studied-heading" className={LABEL}>
            Studied with your instructor
          </h2>
          {taken ? (
            <>
              <p className="mt-2 text-3xl font-semibold text-ink tabular-nums">{hoursOf(taken.minutes)}</p>
              <p className="text-sm text-muted">
                over {taken.sessions} {taken.sessions === 1 ? "session" : "sessions"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">Couldn&rsquo;t load your sessions just now.</p>
          )}
          {agreements.length === 0 && plan && plan.feeMinor > 0 && (
            <p className="mt-4 border-t border-line/60 pt-3 text-sm text-muted">
              Your plan: <span className="text-ink">{InvoiceMath.money(plan.feeMinor, plan.currency)}</span> {PER[plan.unit]}
            </p>
          )}
        </section>

        {prepaid.length > 0 ? (
          <section className={CARD} aria-labelledby="prepaid-heading">
            <h2 id="prepaid-heading" className={LABEL}>
              Left of what you paid for
            </h2>
            {prepaid.map((p) => {
              const left = Math.round((p.billed - p.used) * 100) / 100;
              const unit = p.unit === "hour" ? "h" : left === 1 ? "session" : "sessions";
              const share = Math.min(1, Math.max(0, p.used / p.billed));
              return (
                <div key={p.unit} className="mt-2">
                  <p className={`text-3xl font-semibold tabular-nums ${left < 0 ? "text-gold" : "text-ink"}`}>
                    {left < 0 ? `${-left} ${unit} over` : `${left} ${unit}`}
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line/60" role="img" aria-label={`${p.used} of ${p.billed} used`}>
                    <div className="h-full rounded-full bg-quant" style={{ width: `${share * 100}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-muted">
                    {p.used} of {p.billed} {p.unit === "hour" ? "hours" : "sessions"} used
                  </p>
                </div>
              );
            })}
          </section>
        ) : (
          <NextMonth next={next} plan={plan} />
        )}
      </div>

      {agreements.length > 0 && <Agreements agreements={agreements} current={months.at(-2)!.month} />}

      <MonthRecord months={months} known={taken !== null} />

      <div className={`grid items-start gap-6 ${prepaid.length > 0 ? "lg:grid-cols-[22rem_1fr]" : ""}`}>
        {prepaid.length > 0 && <NextMonth next={next} plan={plan} />}
        <Documents documents={documents} />
      </div>
    </div>
  );
}

/** What was agreed with them: rate, dates (e.g. until the exam) and, for monthly fees, what is still to come. */
function Agreements({ agreements, current }: { agreements: AccountAgreement[]; current: string }) {
  return (
    <section className={`${CARD} sm:p-8`} aria-labelledby="agreement-heading">
      <h2 id="agreement-heading" className="text-2xl font-normal italic">
        {agreements.length === 1 ? "Your agreement" : "Your agreements"}
      </h2>
      <ul className="mt-4 divide-y divide-line/60">
        {agreements.map((a, i) => (
          <li key={i} className="grid gap-x-8 gap-y-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-lg text-ink">{a.serviceName}</p>
              <p className="text-sm text-muted">
                <span className="text-ink tabular-nums">{InvoiceMath.money(a.rateMinor, a.currency)}</span> {PER[a.unit]}, from {DAY.format(new Date(`${a.startsOn}T00:00:00Z`))}
                {a.endsOn ? ` to ${DAY.format(new Date(`${a.endsOn}T00:00:00Z`))}` : ", no end date"}
              </p>
              {a.scope && <p className="mt-1 text-sm text-muted">{a.scope}</p>}
            </div>
            {a.monthsLeft !== null && a.remainingMinor !== null && (
              <div className="sm:text-right">
                <p className="text-2xl font-semibold text-ink tabular-nums">
                  {a.monthsLeft} {a.monthsLeft === 1 ? "month" : "months"} left
                </p>
                <p className="text-sm text-muted">
                  {a.monthsLeft > 0
                    ? `after ${MONTH_LONG.format(monthDate(current)).split(" ")[0]}: ${InvoiceMath.money(a.remainingMinor, a.currency)} to come`
                    : "This is the last month"}
                </p>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function NextMonth({ next, plan }: { next: StudentAccountView["next"]; plan: StudentPlan | null }) {
  const name = MONTH_LONG.format(monthDate(next.month));
  return (
    <section className={CARD} aria-labelledby="next-heading">
      <h2 id="next-heading" className={LABEL}>
        Planning {name}
      </h2>
      <p className="mt-2 text-3xl font-semibold text-ink tabular-nums">{hoursOf(next.minutesBooked)} booked</p>
      <p className="text-sm text-muted">
        {next.paceMinutes !== null ? `You usually study ${hoursOf(next.paceMinutes)} a month.` : "Book ahead to keep your week free."}
      </p>
      {next.estimateMinor !== null && plan && (
        <p className="mt-3 text-sm text-muted">
          {plan.unit === "month" ? "Monthly fee: " : "Estimated fee at that pace: "}
          <span className="text-ink tabular-nums">{InvoiceMath.money(next.estimateMinor, plan.currency)}</span>
          {plan.unit !== "month" && <span className="block text-xs">An estimate only: your invoice counts the sessions you take.</span>}
        </p>
      )}
      <TabButton tab="book" className={`${BOOK_BUTTON} mt-4`}>
        Book a session
      </TabButton>
    </section>
  );
}

/** Bars of hours per month (filled: studied; outlined: booked ahead), then the same months as a table with money. */
function MonthRecord({ months, known }: { months: AccountMonth[]; known: boolean }) {
  const peak = Math.max(60, ...months.map((m) => m.minutesTaken + m.minutesBooked));
  const last = months.length - 1;
  const hasAgreed = months.some((m) => m.agreed.length > 0);
  return (
    <section className={`${CARD} sm:p-8`} aria-labelledby="months-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="months-heading" className="text-2xl font-normal italic">
          Month by month
        </h2>
        <p className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-quant" />
            Studied
          </span>
          <span className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-2.5 rounded-sm border border-dashed border-gold" />
            Booked
          </span>
        </p>
      </div>

      {known && (
        <ol className="mt-6 grid h-44 grid-cols-7 items-end gap-2 sm:gap-4" aria-label="Hours per month">
          {months.map((m, i) => (
            <li key={m.month} className="flex h-full flex-col items-center justify-end gap-2">
              <span className="text-xs text-ink tabular-nums">{m.minutesTaken + m.minutesBooked > 0 ? hoursOf(m.minutesTaken + m.minutesBooked) : ""}</span>
              <div className="flex w-full max-w-12 flex-col justify-end" style={{ height: "70%" }}>
                {m.minutesBooked > 0 && (
                  <div
                    className="w-full rounded-t-md border border-dashed border-gold/80 bg-gold/10"
                    style={{ height: `${(m.minutesBooked / peak) * 100}%` }}
                  />
                )}
                <div
                  className={`w-full bg-quant ${m.minutesBooked > 0 ? "" : "rounded-t-md"} ${m.minutesTaken === 0 ? "h-px bg-line" : ""}`}
                  style={m.minutesTaken > 0 ? { height: `${(m.minutesTaken / peak) * 100}%` } : undefined}
                />
              </div>
              <span className={`text-xs ${i === last ? "font-semibold text-gold" : i === last - 1 ? "font-semibold text-ink" : "text-muted"}`}>
                {MONTH.format(monthDate(m.month))}
              </span>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th scope="col" className="py-2 font-normal">
                Month
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Sessions
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Hours
              </th>
              {hasAgreed && (
                <th scope="col" className="py-2 text-right font-normal">
                  Agreed
                </th>
              )}
              <th scope="col" className="py-2 text-right font-normal">
                Invoiced
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Paid
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {months.toReversed().map((m) => (
              <tr key={m.month}>
                <th scope="row" className="py-2.5 text-left font-normal text-ink">
                  {MONTH_LONG.format(monthDate(m.month))}
                </th>
                <td className="py-2.5 text-right text-ink">
                  {known ? m.sessionsTaken : "–"}
                  {m.sessionsBooked > 0 && <span className="text-gold"> +{m.sessionsBooked} booked</span>}
                </td>
                <td className="py-2.5 text-right text-ink">
                  {known ? hoursOf(m.minutesTaken) : "–"}
                  {m.minutesBooked > 0 && <span className="text-gold"> +{hoursOf(m.minutesBooked)}</span>}
                </td>
                {hasAgreed && <td className="py-2.5 text-right text-muted">{amounts(m.agreed)}</td>}
                <td className="py-2.5 text-right text-ink">{amounts(m.billed)}</td>
                <td className="py-2.5 text-right text-ink">{amounts(m.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">
        Hours are the time you actually studied, as your instructor records it; sessions you book count on their own. Months run on UAE time.
        {hasAgreed && " The invoice is what you pay for a month, which can be less than agreed."}
      </p>
    </section>
  );
}

function Documents({ documents }: { documents: ClientDocument[] | null }) {
  return (
    <section className={`${CARD} sm:p-8`} aria-labelledby="documents-heading">
      <h2 id="documents-heading" className="text-2xl font-normal italic">
        Invoices &amp; receipts
      </h2>
      {documents === null ? (
        <p className="mt-3 text-sm text-muted">Couldn&rsquo;t load your invoices right now. Each one was also emailed to you.</p>
      ) : documents.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Your invoices and receipts will appear here once your instructor issues them.</p>
      ) : (
        <ul className="mt-4 divide-y divide-line/60 text-sm">
          {documents.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3">
              <div>
                <p className="text-ink">
                  {DOC[d.docType]} {d.number}
                </p>
                <p className="text-xs text-muted">{d.issueDate && DAY.format(new Date(`${d.issueDate}T00:00:00Z`))}</p>
              </div>
              <div className="flex items-center gap-4 tabular-nums">
                <span className="text-ink">{InvoiceMath.money(d.totalMinor, d.currency)}</span>
                {d.docType === "invoice" && (
                  <span className={d.balanceMinor > 0 ? "text-gold" : "text-quant"}>
                    {d.balanceMinor > 0 ? `${InvoiceMath.money(d.balanceMinor, d.currency)} due` : "Paid"}
                  </span>
                )}
                {d.token && (
                  <a href={`/invoice/${d.token}`} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                    View
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
