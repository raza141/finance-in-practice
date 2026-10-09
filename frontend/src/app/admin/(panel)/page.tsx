import type { Metadata } from "next";
import Link from "next/link";

import { DashboardMetrics } from "@/domains/admin/services/DashboardMetrics";
import { IncomeChart, Panel, StatCard } from "@/domains/admin/components/DashboardCards";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { badgeFor, formatDubai, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { ArticleRepository } from "@/domains/journal/server/ArticleRepository";
import { TestimonialRepository } from "@/domains/testimonials/server/TestimonialRepository";

export const metadata: Metadata = { title: "Dashboard" };

const ACTIONS = [
  ["New invoice", "/admin/invoices/new"],
  ["Add client / contract", "/admin/clients"],
  ["Block time", "/admin/schedule"],
  ["Write article", "/admin/journal"],
] as const;

/** A source's value, or the fallback (logged) when it failed, so one outage doesn't blank the dashboard. */
async function safely<T>(promise: Promise<T> | undefined, fallback: T, source: string): Promise<T> {
  try {
    return (await promise) ?? fallback;
  } catch (error) {
    console.error(`[dashboard] ${source} failed`, error);
    return fallback;
  }
}

/** Money, clients, sessions and content at a glance. Amounts are per currency, months are Dubai months. */
export default async function AdminDashboardPage() {
  await AdminAuth.requireOwner();
  const invoices = InvoiceRepository.fromEnv();
  if (!invoices) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const clients = ClientRepository.fromEnv();
  const articles = ArticleRepository.fromEnv();
  const cal = CalComClient.fromEnv();
  const now = new Date();
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();

  const [money, awaiting, people, recentClients, sessions, testimonials, articleCounts, inReview] = await Promise.all([
    safely(invoices.dashboard(), { currencies: [], drafts: 0, quotesAwaiting: 0, recurringDue: 0, paidByMonth: [] }, "Invoice totals"),
    safely(invoices.awaitingPayment(), [], "Awaiting payment"),
    safely(clients?.dashboard(), null, "Client totals"),
    safely(clients?.recent(), [], "Recent clients"),
    safely(cal?.bookings(now.toISOString(), new Date(now.getTime() + 7 * 86_400_000).toISOString()), [], "Cal.com bookings"),
    safely(TestimonialRepository.fromEnv()?.counts(), null, "Testimonials"),
    safely(articles?.counts(), null, "Articles"),
    safely(articles?.pendingReviews(), 0, "Article reviews"),
  ]);

  const amounts = (pick: (c: (typeof money.currencies)[number]) => number) =>
    DashboardMetrics.amounts(money.currencies.map((c) => ({ currency: c.currency, minor: pick(c) })));
  const sum = (pick: (c: (typeof money.currencies)[number]) => number) => money.currencies.reduce((n, c) => n + pick(c), 0);
  const pendingCount = sum((c) => c.pendingCount);
  const overdueCount = sum((c) => c.overdueCount);
  // A change figure only makes sense in a single currency.
  const main = money.currencies.length === 1 ? money.currencies[0] : null;
  const change = main ? DashboardMetrics.change(main.paidThisMonthMinor, main.paidLastMonthMinor) : null;
  const chart = DashboardMetrics.incomeChart(money.paidByMonth, today);
  const upcoming = sessions.filter((s) => s.status !== "cancelled" && s.status !== "rejected").slice(0, 5);
  const monthName = new Date(`${today}T12:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", month: "long" });

  return (
    <div className="max-w-6xl">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight italic">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">{InvoiceEmails.day(today)} · figures for {monthName} (Dubai time)</p>
        </div>
        <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
          {ACTIONS.map(([label, href], i) => (
            <Link
              key={href}
              href={href}
              className={i === 0 ? "h-9 rounded-md bg-gold px-3 py-2 text-sm font-medium text-canvas hover:bg-gold-bright" : "h-9 rounded-md border border-line px-3 py-2 text-sm text-muted hover:text-ink"}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <li>
          <StatCard
            label={`Income · ${monthName}`}
            value={amounts((c) => c.paidThisMonthMinor)}
            tone="quant"
            href="/admin/invoices"
            sub={
              change === null
                ? `Last month: ${amounts((c) => c.paidLastMonthMinor)}`
                : `${change >= 0 ? "▲" : "▼"} ${Math.abs(change)}% vs last month (${amounts((c) => c.paidLastMonthMinor)})`
            }
          />
        </li>
        <li>
          <StatCard label="Awaiting payment" value={amounts((c) => c.pendingMinor)} href="/admin/invoices" sub={`${pendingCount} issued invoice${pendingCount === 1 ? "" : "s"} unpaid`} />
        </li>
        <li>
          <StatCard
            label="Overdue"
            value={amounts((c) => c.overdueMinor)}
            tone={overdueCount > 0 ? "gold" : "ink"}
            href="/admin/invoices"
            sub={overdueCount > 0 ? `${overdueCount} past the due date: follow up` : "Nothing overdue"}
          />
        </li>
        <li>
          <StatCard
            label="Expected monthly"
            value={DashboardMetrics.amounts((people?.expectedMonthly ?? []).map((e) => ({ currency: e.currency, minor: e.totalMinor })))}
            href="/admin/clients"
            sub={`From ${people?.byPlan.month ?? 0} client${people?.byPlan.month === 1 ? "" : "s"} on monthly plans`}
          />
        </li>
      </ul>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Panel title="Income, last 6 months" className="lg:col-span-2">
          <IncomeChart currency={chart.currency} bars={chart.bars} />
        </Panel>
        <Panel title="Clients" href="/admin/clients">
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-xs text-muted">Total</dt>
              <dd className="tabular-data text-2xl">{people?.total ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">New in {monthName}</dt>
              <dd className={`tabular-data text-2xl ${people?.newThisMonth ? "text-quant" : ""}`}>{people?.newThisMonth ?? 0}</dd>
            </div>
          </dl>
          <ul className="mt-5 grid gap-2 border-t border-line pt-4 text-sm">
            {(Object.entries(InvoiceContract.UNITS) as [keyof typeof InvoiceContract.UNITS, string][]).map(([unit, label]) => (
              <li key={unit} className="flex justify-between">
                <span className="text-muted">{label} plans</span>
                <span className="tabular-data">{people?.byPlan[unit] ?? 0}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-4 grid gap-1 text-xs text-muted">
            <li>
              {money.drafts > 0 ? (
                <Link href="/admin/invoices" className="text-gold hover:underline">
                  {money.drafts} draft{money.drafts === 1 ? "" : "s"} not issued yet
                </Link>
              ) : (
                "No drafts waiting."
              )}
            </li>
            {money.recurringDue > 0 && (
              <li>
                <Link href="/admin/invoices" className="text-gold hover:underline">
                  {money.recurringDue} recurring draft{money.recurringDue === 1 ? "" : "s"} due this month
                </Link>
              </li>
            )}
            {money.quotesAwaiting > 0 && (
              <li>
                <Link href="/admin/invoices?type=quote" className="text-quant hover:underline">
                  {money.quotesAwaiting} quote{money.quotesAwaiting === 1 ? "" : "s"} awaiting a reply
                </Link>
              </li>
            )}
          </ul>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel title="Awaiting payment" href="/admin/invoices">
          {awaiting.length === 0 ? (
            <p className="text-sm text-muted">Every issued invoice is paid.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {awaiting.map((invoice) => (
                <li key={invoice.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-quant hover:underline">
                    {invoice.number}
                  </Link>
                  <span className="min-w-0 flex-1 truncate">{invoice.clientName}</span>
                  <span className="text-xs text-muted">due {InvoiceEmails.day(invoice.dueDate)}</span>
                  <span className="font-mono tabular-nums">{InvoiceMath.money(invoice.totalMinor, invoice.currency)}</span>
                  <StatusBadge status={badgeFor(invoice, today)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Sessions, next 7 days" href="/admin/schedule" linkLabel="Schedule →">
          {!cal ? (
            <p className="text-sm text-muted">Cal.com is not configured.</p>
          ) : upcoming.length === 0 ? (
            <p className="text-sm text-muted">No sessions booked this week.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {upcoming.map((session) => (
                <li key={session.uid} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                  <span className="font-mono text-xs text-muted tabular-nums">{formatDubai(new Date(session.start))}</span>
                  <span className="min-w-0 flex-1 truncate">{session.attendees[0]?.name ?? session.title}</span>
                  {session.attendees[0] && (
                    <Link href={`/admin/invoices/new?booking=${encodeURIComponent(session.uid)}`} className="text-xs text-quant hover:underline">
                      Invoice →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Newest clients" href="/admin/clients">
          {recentClients.length === 0 ? (
            <p className="text-sm text-muted">No clients yet. Website bookings add them automatically.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {recentClients.map((client) => (
                <li key={client.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5">
                  <Link href={`/admin/clients/${client.id}`} className="text-quant hover:underline">
                    {client.name}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-xs text-muted">{client.courses.join(", ")}</span>
                  <span className="font-mono text-xs text-muted">{InvoiceContract.planSummary(client) || "No plan"}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Content">
          <ul className="grid grid-cols-2 gap-3 text-sm">
            {(
              [
                ["Testimonials to review", testimonials?.pending ?? 0, "/admin/testimonials?status=pending"],
                ["Approved testimonials", testimonials?.approved ?? 0, "/admin/testimonials?status=approved"],
                ["Articles in review", inReview, "/admin/journal?show=review"],
                ["Published articles", articleCounts?.published ?? 0, "/admin/journal?show=live"],
              ] as const
            ).map(([label, n, href], i) => (
              <li key={label}>
                <Link href={href} className="block rounded-lg border border-line p-3 transition-colors hover:border-quant/50">
                  <span className="block text-xs text-muted">{label}</span>
                  <span className={`tabular-data mt-1 block text-xl ${i % 2 === 0 && n > 0 ? "text-gold" : ""}`}>{n}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
