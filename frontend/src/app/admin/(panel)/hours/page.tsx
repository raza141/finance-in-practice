import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/core/config/site";
import { FIELD } from "@/domains/admin/components/FormField";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { CalComClient, type CalBookingDetail } from "@/domains/booking/server/CalComClient";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { SessionLogRepository } from "@/domains/students/server/SessionLogRepository";
import { Capacity } from "@/domains/students/services/Capacity";

export const metadata: Metadata = { title: "Hours & pay" };

const MONTH = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} h`;
const money = (list: { currency: Parameters<typeof InvoiceMath.money>[1]; minor: number }[]) =>
  list.length ? list.map((m) => InvoiceMath.money(m.minor, m.currency)).join(" + ") : "–";

/** One month across clients: 1-on-1 hours taught against what each pays, to see where the time goes. */
export default async function HoursPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await AdminAuth.requireOwner();
  const query = await searchParams;
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const month = typeof query.month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(query.month) ? query.month : today.slice(0, 7);
  const next = InvoiceMath.addMonths(`${month}-01`, 1).slice(0, 7);
  const cal = CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug);
  // ponytail: one Cal.com page of 250 bookings a month; page through it if a month ever holds more.
  const [clients, bookings, moneyRows, agreements] = await Promise.all([
    ClientRepository.fromEnv()?.all() ?? [],
    (cal?.bookings(`${month}-01T00:00:00+04:00`, `${next}-01T00:00:00+04:00`) ?? Promise.resolve([])).catch((error): CalBookingDetail[] | null => {
      console.error("admin hours: could not load Cal.com bookings", error);
      return null;
    }),
    InvoiceRepository.fromEnv()?.monthByClient(month) ?? [],
    AgreementRepository.fromEnv()?.active() ?? [],
  ]);
  const log = (await SessionLogRepository.fromEnv()?.forBookingsAndMonth((bookings ?? []).map((b) => b.uid), month)) ?? [];
  const rows = Capacity.rows({ clients, bookings: bookings ?? [], log, money: moneyRows, agreements, month, freeSlug: process.env.NEXT_PUBLIC_CAL_LINK?.split("/")[1]?.trim() });
  const taught = rows.reduce((sum, r) => sum + r.minutesTaught, 0);
  const booked = rows.reduce((sum, r) => sum + r.minutesBooked, 0);

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-normal tracking-tight italic">Hours &amp; pay</h1>
          <p className="mt-2 text-sm text-muted">
            1-on-1 hours you taught each client in {MONTH.format(new Date(`${month}-01T00:00:00Z`))}, with your corrections, against what they pay. Group classes and the free
            diagnostic are left out.
          </p>
        </div>
        <form className="flex items-end gap-2">
          <label className="text-xs text-muted">
            Month
            <input name="month" type="month" defaultValue={month} className={`${FIELD} mt-1 py-1.5`} />
          </label>
          <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
            Show
          </button>
        </form>
      </div>

      <p className="mt-6 text-lg text-ink">
        {hours(taught)} taught{booked > 0 && `, ${hours(booked)} still booked`}, across {rows.filter((r) => r.minutesTaught + r.minutesBooked > 0).length} students
      </p>
      {bookings === null && <p className="mt-2 text-sm text-gold">Couldn&rsquo;t load Cal.com: only hand-logged hours are counted.</p>}

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing taught, invoiced or agreed this month.</p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="py-2 pr-4 font-normal">Client</th>
                <th className="py-2 pr-4 text-right font-normal">Taught</th>
                <th className="py-2 pr-4 text-right font-normal">Booked</th>
                <th className="py-2 pr-4 text-right font-normal">Included</th>
                <th className="py-2 pr-4 text-right font-normal">Agreed</th>
                <th className="py-2 pr-4 text-right font-normal">Invoiced</th>
                <th className="py-2 pr-4 text-right font-normal">Paid</th>
                <th className="py-2 text-right font-normal">Per hour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {rows.map((r) => {
                const over = r.includedMinutes !== null && r.minutesTaught + r.minutesBooked > r.includedMinutes;
                return (
                  <tr key={r.clientId}>
                    <td className="py-2.5 pr-4">
                      <Link href={`/admin/clients/${r.clientId}#sessions`} className="text-quant hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-ink">
                      {hours(r.minutesTaught)} <span className="text-xs text-muted">({r.sessions})</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-muted">{r.minutesBooked ? hours(r.minutesBooked) : "–"}</td>
                    <td className={`py-2.5 pr-4 text-right ${over ? "text-gold" : "text-muted"}`}>{r.includedMinutes !== null ? hours(r.includedMinutes) : "–"}</td>
                    <td className="py-2.5 pr-4 text-right text-muted">{money(r.agreed)}</td>
                    <td className="py-2.5 pr-4 text-right text-ink">{money(r.invoiced)}</td>
                    <td className="py-2.5 pr-4 text-right text-ink">{money(r.paid)}</td>
                    <td className="py-2.5 text-right text-ink">
                      {r.perHour ? (
                        <>
                          {InvoiceMath.money(r.perHour.minor, r.perHour.currency)}
                          {r.perHour.basis === "agreed" && <span className="block text-xs text-muted">agreed, not invoiced</span>}
                        </>
                      ) : (
                        "–"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Per hour = this month&rsquo;s invoices (or the agreed monthly fee before you invoice) ÷ hours taught. Included turns gold when taught + booked passes it.
      </p>
    </div>
  );
}
