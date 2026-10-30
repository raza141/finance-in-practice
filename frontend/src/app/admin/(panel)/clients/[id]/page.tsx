import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FIELD } from "@/domains/admin/components/FormField";
import { PageHeader, PRIMARY_ACTION, SECONDARY_ACTION } from "@/domains/admin/components/PageHeader";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { applyPackage } from "@/domains/packages/actions/packages";
import { PackageRepository } from "@/domains/packages/server/PackageRepository";
import { PackageTable } from "@/domains/packages/services/PackageTable";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminInbox } from "@/domains/admin/server/AdminInbox";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { ServiceRepository } from "@/domains/catalogue/server/ServiceRepository";
import { CatalogueContract } from "@/domains/catalogue/services/CatalogueContract";
import { addAgreement, deleteClient, endAgreement } from "@/domains/invoices/actions/billing";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { badgeFor, StatusBadge } from "@/domains/invoices/components/AdminBits";
import { ClientForm } from "@/domains/invoices/components/BillingForms";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceEmails } from "@/domains/invoices/services/InvoiceEmails";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { Ledger } from "@/domains/invoices/services/Ledger";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import { siteConfig } from "@/core/config/site";
import { CalComClient } from "@/domains/booking/server/CalComClient";
import { SessionLogEditor } from "@/domains/students/components/SessionLogEditor";
import { StudyPlanEditor } from "@/domains/students/components/StudyPlanEditor";
import { HourRequestRepository } from "@/domains/students/server/HourRequestRepository";
import { SessionLogRepository } from "@/domains/students/server/SessionLogRepository";
import { Allowance } from "@/domains/students/services/Allowance";
import { StudentSessions } from "@/domains/students/services/StudentSessions";
import { previewWeeklyEmail, saveClassroomEmail } from "@/domains/classroom/actions/classroom";
import { addPrivateClassroom, decideClassroom, removePrivateClassroom, setClientBatch } from "@/domains/students/actions/classroom";
import { ClassroomRepository } from "@/domains/students/server/ClassroomRepository";
import { Batches } from "@/domains/students/services/Batches";
import { StudyPlanRepository } from "@/domains/students/server/StudyPlanRepository";
import { endAccessGrant } from "@/domains/mocks/actions/mocks";
import { AccessGrantForm } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockGrader } from "@/domains/mocks/services/MockGrader";

export const metadata: Metadata = { title: "Client" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  "agreement-added": { text: "Agreement added. It is offered on this client's new documents for that service.", tone: "ok" },
  "agreement-ended": { text: "Agreement ended. Documents that used it keep their rates.", tone: "ok" },
  "agreement-refused": { text: "Agreement not added.", tone: "warn" },
  "plan-saved": { text: "Study plan saved.", tone: "ok" },
  "package-applied": { text: "Package applied from today: their previous package agreement ended and the new one is under Agreements.", tone: "ok" },
  "package-dismissed": { text: "Request closed.", tone: "ok" },
  "package-refused": { text: "Package not changed.", tone: "warn" },
  "hours-saved": { text: "Hours saved: their Hours & payments tab shows them now.", tone: "ok" },
  "hours-refused": { text: "Hours not saved.", tone: "warn" },
  "plan-refused": { text: "Study plan not saved.", tone: "warn" },
  "classroom-approved": { text: "Classroom access approved: the join button now shows in their portal.", tone: "ok" },
  "classroom-removed": {
    text: "Classroom invite hidden from their portal. If they already joined, also remove them in Google Classroom (People).",
    tone: "ok",
  },
  "classroom-email-saved": { text: "Classroom email saved: their portal reads Classroom with it from now on.", tone: "ok" },
  "digest-sent": { text: "Preview sent to your inbox: it's what they'd get on Sunday.", tone: "ok" },
  "digest-quiet": { text: "Nothing to send them this week (nothing due, missing, new or marked), so they won't get one.", tone: "ok" },
  "digest-unavailable": { text: "No preview: Classroom isn't connected or email isn't set up.", tone: "warn" },
  "digest-failed": { text: "Preview failed. Try again in a minute.", tone: "warn" },
  "classroom-email-invalid": { text: "Not saved: that doesn't look like an email address.", tone: "warn" },
  "private-duplicate": { text: "Not added: that link is a Google class already in their portal.", tone: "warn" },
  "classroom-duplicate": { text: "Not approved: this course's Google class is already in their portal as a private classroom.", tone: "warn" },
  "batch-saved": { text: "Batch saved: their portal shows that batch's class.", tone: "ok" },
  "batch-moved": {
    text: "Batch changed: their portal shows the new class, and they ask to join it afresh. Also remove them from the old class in Google Classroom (People).",
    tone: "ok",
  },
  "batch-refused": { text: "Not saved: choose one of the listed sittings.", tone: "warn" },
  "private-added": { text: "Private classroom added: it shows in their portal now.", tone: "ok" },
  "private-removed": { text: "Private classroom removed from their portal. Also remove them in Google Classroom (People).", tone: "ok" },
  "private-refused": {
    text: "Not added: give it a title (up to 120 characters), a line up to 160, and an invite link starting with https://classroom.google.com/.",
    tone: "warn",
  },
};

const LEDGER_KIND = { invoice: "Invoice", receipt: "Receipt", credit_note: "Credit note", payment: "Payment for" } as const;

/** Edit a saved client; see their account (running balance), statements and every document. */
export default async function ClientPage({ params, searchParams }: PageProps<"/admin/clients/[id]">) {
  await AdminAuth.requireOwner();
  const { id } = await params;
  const client = await ClientRepository.fromEnv()?.byId(id);
  if (!client) notFound();
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  const invoiceRepo = InvoiceRepository.fromEnv();
  const classroomRepo = ClassroomRepository.fromEnv();
  const [invoices, courses, entries, agreements, services, plan, classrooms, privateClasses, classroomEmail, batchCourses, bookings, sessionLog, hourRequests] = await Promise.all([
    invoiceRepo?.list({ clientId: client.id }) ?? [],
    CourseRepository.fromEnv()?.all() ?? [],
    invoiceRepo?.ledger(client.id) ?? [],
    AgreementRepository.fromEnv()?.forClient(client.id) ?? [],
    ServiceRepository.fromEnv()?.all() ?? [],
    StudyPlanRepository.fromEnv()?.forClient(client.id) ?? [],
    classroomRepo?.forClient(client.id, client.courses) ?? [],
    classroomRepo?.privateFor(client.id) ?? [],
    classroomRepo?.classroomEmail(client.id) ?? null,
    classroomRepo?.batchCourses() ?? [],
    // Null (not empty) when Cal.com is unreachable, so the editor says so.
    (CalComClient.fromEnv(process.env, siteConfig.studentBooking.eventSlug)?.bookingsFor(client.email) ?? Promise.resolve([])).catch((error) => {
      console.error("admin: could not load Cal.com sessions", error);
      return null;
    }),
    // Never takes the client page down (e.g. before 049_session_log is applied).
    (SessionLogRepository.fromEnv()?.forClient(client.id) ?? Promise.resolve([])).catch((error) => {
      console.error("admin: could not load the session log", error);
      return [];
    }),
    HourRequestRepository.fromEnv()?.forClient(client.id) ?? [],
    AdminInbox.markSeen(client.id),
  ]);
  // Never takes the client page down (e.g. before 055_mock_exams is applied).
  const mockAttempts = await (MockRepository.fromEnv()?.history(client.id) ?? Promise.resolve([])).catch((error) => {
    console.error("admin: could not load mock attempts", error);
    return [];
  });
  const [accessGrants, grantableMocks] = await Promise.all([
    MockRepository.fromEnv()?.grants(client.id) ?? [],
    MockRepository.fromEnv()?.all() ?? [],
  ]).catch((error) => {
    console.error("admin: could not load access grants", error);
    return [[], []] as [never[], never[]];
  });
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const reason = typeof query.reason === "string" ? query.reason : null;
  const ledger = Ledger.running(entries);

  const allowance =
    bookings &&
    Allowance.forDate({
      agreements,
      requests: hourRequests,
      bookings: StudentSessions.applyLog(bookings, sessionLog),
      manual: sessionLog.flatMap((l) => (l.onDate ? [{ date: l.onDate, minutes: l.minutes }] : [])),
      date: today,
      freeSlug: process.env.NEXT_PUBLIC_CAL_LINK?.split("/")[1]?.trim(),
    });
  // The closing balance per currency (never added across).
  const balances = [...new Map(ledger.map((row) => [row.currency, row.balanceMinor])).entries()];
  const agreement = agreements[0];
  const pendingRequests = hourRequests.filter((r) => r.status === "pending").length;
  const JUMPS = [
    ["agreements", "Agreements"],
    ["sessions", "Hours"],
    ["account", "Account"],
    ["documents", "Documents"],
    ["study-plan", "Study plan"],
    ["mocks", "Mock exams"],
    ["access", "Access"],
    ["classroom", "Classroom"],
    ["details", "Details"],
  ] as const;

  // Never takes the client page down (e.g. before 053_packages is applied).
  const packageRepo = PackageRepository.fromEnv();
  const [pkg, packages] = await Promise.all([
    (packageRepo?.ofClient(client.id) ?? Promise.resolve(null)).catch(() => null),
    (packageRepo?.active() ?? Promise.resolve([])).catch(() => []),
  ]);
  return (
    <div className="max-w-5xl">
      <Link href="/admin/clients" className="text-sm text-muted hover:text-ink">
        ← Clients
      </Link>
      <div className="mt-3">
        <PageHeader
          title={client.name}
          description={[client.email, client.phone, client.courses.join(", ")].filter(Boolean).join(" · ")}
          actions={
            <>
              {/* Only enrolled students (a course) have a portal. */}
              {client.courses.length > 0 && (
                <Link href={`/admin/view-as/${client.id}`} className={SECONDARY_ACTION}>
                  View as student
                </Link>
              )}
              <Link href={`/admin/invoices/new?client=${client.id}&type=quote`} className={SECONDARY_ACTION}>
                New quote
              </Link>
              <Link href={`/admin/invoices/new?client=${client.id}`} className={PRIMARY_ACTION}>
                New invoice
              </Link>
            </>
          }
        />
      </div>

      {pkg && (pkg.current || pkg.requested || client.courses.length > 0) && (
        <section
          aria-label="Package"
          className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-sm ${pkg.requested ? "border-gold/40 bg-gold/5" : "border-line bg-surface"}`}
        >
          <p className="text-ink">
            <strong>{pkg.current ? `Package: ${pkg.current.name}` : "No package"}</strong>
            {pkg.current && !PackageTable.isCustom(pkg.current) && (
              <span className="text-muted">
                {" "}
                ({PackageTable.hours(pkg.current)}, {PackageTable.price(pkg.current)})
              </span>
            )}
            {pkg.requested && <span className="block text-gold">Asks to move to {pkg.requested.name}.</span>}
            {pkg.current && PackageTable.isCustom(pkg.current) && !agreement && (
              <span className="block text-muted">Custom: agree the terms on WhatsApp, then send a quote with the agreement.</span>
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {pkg.requested ? (
              <>
                <form action={applyPackage} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="packageId" value={pkg.requested.id} />
                  <input name="startsOn" type="date" required defaultValue={today} max={today} aria-label="Starts on" className="h-9 rounded-md border border-line bg-canvas px-2 text-sm text-ink" />
                  <input name="price" inputMode="decimal" placeholder="Package price" aria-label="Agreed price (blank: the package price)" className="h-9 w-32 rounded-md border border-line bg-canvas px-2 text-sm text-ink" />
                  <PendingButton pendingLabel="Applying…" className={PRIMARY_ACTION}>
                    Apply {pkg.requested.name}
                  </PendingButton>
                </form>
                <form action={applyPackage}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="answer" value="dismiss" />
                  <PendingButton pendingLabel="Closing…" className={SECONDARY_ACTION}>
                    Close request
                  </PendingButton>
                </form>
              </>
            ) : (
              <form action={applyPackage} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="clientId" value={client.id} />
                <select name="packageId" required defaultValue="" aria-label="Change package" className="h-9 rounded-md border border-line bg-canvas px-2 text-sm text-ink">
                  <option value="" disabled>
                    {pkg.current ? "Change package" : "Set package"}
                  </option>
                  {(Object.keys(PackageTable.AUDIENCE) as (keyof typeof PackageTable.AUDIENCE)[]).map((audience) => (
                    <optgroup key={audience} label={PackageTable.AUDIENCE[audience]}>
                      {packages
                        .filter((p) => p.audience === audience)
                        .map((p) => (
                          <option key={p.id} value={p.id} disabled={p.id === pkg.current?.id}>
                            {p.name}
                            {p.id === pkg.current?.id && " (current)"}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                <input name="startsOn" type="date" required defaultValue={today} max={today} aria-label="Starts on" className="h-9 rounded-md border border-line bg-canvas px-2 text-sm text-ink" />
                  <input name="price" inputMode="decimal" placeholder="Package price" aria-label="Agreed price (blank: the package price)" className="h-9 w-32 rounded-md border border-line bg-canvas px-2 text-sm text-ink" />
                <PendingButton pendingLabel="Saving…" className={SECONDARY_ACTION}>
                  Apply from this date
                </PendingButton>
              </form>
            )}
          </div>
        </section>
      )}

      <dl className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Balance</dt>
          <dd className="tabular-data mt-1 text-lg">
            {balances.length === 0
              ? "Nothing issued"
              : balances.map(([currency, minor]) => (
                  <span key={currency} className={`block ${minor > 0 ? "text-gold" : "text-quant"}`}>
                    {minor > 0 ? `${InvoiceMath.money(minor, currency)} to pay` : minor < 0 ? `${InvoiceMath.money(-minor, currency)} in credit` : "All paid"}
                  </span>
                ))}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Agreement</dt>
          <dd className="mt-1 text-sm">
            {agreement ? (
              <>
                <span className="block text-ink">
                  {InvoiceMath.money(agreement.rateMinor, agreement.currency)} {InvoiceContract.UNITS[agreement.unit].toLowerCase()}
                  {agreement.hoursPerMonth !== null && ` · ${agreement.hoursPerMonth} h ${agreement.unit === "package" ? "package" : "a month"}`}
                </span>
                <span className={`block text-xs ${agreement.acceptedAt ? "text-quant" : "text-gold"}`}>
                  {agreement.acceptedAt ? "Accepted" : "Not accepted yet"}
                  {agreement.endsOn && ` · ends ${InvoiceEmails.day(agreement.endsOn)}`}
                </span>
              </>
            ) : (
              <span className="text-muted">{InvoiceContract.planSummary(client) || "None: catalogue prices apply"}</span>
            )}
          </dd>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <dt className="text-xs text-muted">Hours this agreement month</dt>
          <dd className="mt-1 text-sm">
            {allowance ? (
              <>
                <span className={`tabular-data block text-lg ${allowance.leftMinutes < 0 ? "text-gold" : "text-ink"}`}>
                  {Math.round(((allowance.takenMinutes + allowance.bookedMinutes) / 60) * 10) / 10} of {Math.round(((allowance.includedMinutes + allowance.extraMinutes) / 60) * 10) / 10} h
                </span>
                {pendingRequests > 0 && <span className="block text-xs text-gold">Asks for more hours</span>}
              </>
            ) : (
              <span className="text-muted">No monthly hours limit</span>
            )}
          </dd>
        </div>
      </dl>

      <nav aria-label="Sections" className="sticky top-0 z-10 -mx-1 mt-5 flex gap-1 overflow-x-auto border-b border-line bg-canvas/95 px-1 py-2 backdrop-blur">
        {JUMPS.map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-md px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-raised hover:text-ink">
            {label}
          </a>
        ))}
      </nav>

      {notice && (
        <p role="status" className={`mt-4 text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
          {notice.text}
          {reason && ` ${reason}`}
        </p>
      )}

      <section id="agreements" className="mt-8 scroll-mt-16 rounded-lg border border-line p-5">
        <h2 className="text-lg">Agreements</h2>
        <p className="mt-1 text-sm text-muted">
          An agreed rate for one service, basis and currency over dates. On a new document it is offered for that service, never applied without you picking it.
        </p>
        {agreements.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No agreements: new lines use catalogue prices.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60 text-sm">
            {agreements.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="font-mono text-quant">{a.serviceCode}</span>
                <span className="flex-1">
                  {a.serviceName} · {InvoiceMath.money(a.rateMinor, a.currency)} {InvoiceContract.UNITS[a.unit].toLowerCase()}
                  <span className="text-muted">
                    {" "}
                    · {InvoiceEmails.day(a.startsOn)} – {a.endsOn ? InvoiceEmails.day(a.endsOn) : "open"}
                    {a.paymentTerms && ` · ${InvoiceContract.termsLabel(a.paymentTerms, a.termsDays)}`}
                    {a.schedule && ` · ${a.schedule}`}
                  </span>
                  {a.hoursPerMonth !== null && <span className="block text-xs text-ink">{a.hoursPerMonth} h {a.unit === "package" ? "in the package" : "a month included"}</span>}
                  {a.scope && <span className="block text-xs text-muted">{a.scope}</span>}
                  <span className={`block text-xs ${a.acceptedAt ? "text-quant" : "text-gold"}`}>
                    {a.acceptedAt ? `Accepted in the portal ${InvoiceEmails.day(a.acceptedAt.toISOString().slice(0, 10))}` : "Waiting for the student to accept it in their portal"}
                  </span>
                </span>
                <form action={endAgreement}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="agreementId" value={a.id} />
                  <PendingButton pendingLabel="Ending…" className="text-xs text-red-300/90 hover:underline">
                    End
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        {services.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Add services first under{" "}
            <Link href="/admin/services" className="text-quant hover:underline">
              Services
            </Link>
            .
          </p>
        ) : (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-quant">+ New agreement</summary>
            <form action={addAgreement} className="mt-4 grid items-end gap-3 sm:grid-cols-4">
              <input type="hidden" name="clientId" value={client.id} />
              <label className="text-xs text-muted sm:col-span-2">
                Service
                <select name="serviceId" required className={`${FIELD} mt-1`}>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {CatalogueContract.label(s)} ({s.units.map((u) => InvoiceContract.UNITS[u].toLowerCase()).join(", ")})
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Billed
                <select name="unit" className={`${FIELD} mt-1`}>
                  {CatalogueContract.UNIT_ORDER.map((u) => (
                    <option key={u} value={u}>
                      {InvoiceContract.UNITS[u]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Currency
                <select name="currency" defaultValue={client.planCurrency} className={`${FIELD} mt-1`}>
                  {InvoiceContract.CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-muted">
                Agreed rate or fee
                <input name="rate" inputMode="decimal" required placeholder="0.00" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                From
                <input name="startsOn" type="date" required defaultValue={today} className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                Until (optional)
                <input name="endsOn" type="date" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                Terms (optional)
                <span className="mt-1 flex gap-2">
                  <select name="paymentTerms" className={`${FIELD} mt-0`}>
                    <option value="">Client / default</option>
                    {InvoiceContract.OFFERED_TERMS.filter((t) => t !== "date").map((t) => (
                      <option key={t} value={t}>
                        {InvoiceContract.PAYMENT_TERMS[t]}
                      </option>
                    ))}
                  </select>
                  <input name="termsDays" aria-label="Days, for custom terms" inputMode="numeric" placeholder="days" className={`${FIELD} mt-0 w-16`} />
                </span>
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                Billing schedule (optional)
                <input name="schedule" maxLength={200} placeholder="e.g. Billed on the 1st of each month" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted">
                Hours included a month (monthly only)
                <input name="hoursPerMonth" inputMode="decimal" placeholder="e.g. 30" className={`${FIELD} mt-1`} />
              </label>
              <label className="text-xs text-muted sm:col-span-2">
                Scope / included (optional)
                <input name="scope" maxLength={500} placeholder="e.g. 8 sessions a month, mock exams included" className={`${FIELD} mt-1`} />
              </label>
              <PendingButton pendingLabel="Adding…" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink sm:col-span-4 sm:justify-self-start">
                Add agreement
              </PendingButton>
            </form>
          </details>
        )}
      </section>

      <SessionLogEditor
        clientId={client.id}
        bookings={bookings}
        log={sessionLog}
        today={today}
        requests={hourRequests}
        allowance={allowance}
      />

      <section id="account" className="scroll-mt-16">
      <div className="mt-12 mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg">Account</h2>
        <form action={`/admin/statement/${client.id}`} target="_blank" className="flex items-end gap-2">
          <label className="text-xs text-muted">
            Statement for
            <input name="month" type="month" required defaultValue={today.slice(0, 7)} className={`${FIELD} mt-1 py-1.5`} />
          </label>
          <button type="submit" className="h-9 rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
            Statement PDF ↓
          </button>
        </form>
      </div>
      {ledger.length === 0 ? (
        <p className="text-sm text-muted">No issued documents or payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-[11px] tracking-[0.18em] text-muted uppercase">
                <th className="py-2 pr-4 font-normal">Date</th>
                <th className="py-2 pr-4 font-normal">Item</th>
                <th className="py-2 pr-4 text-right font-normal">Debit</th>
                <th className="py-2 pr-4 text-right font-normal">Credit</th>
                <th className="py-2 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((row, index) => (
                <tr key={index} className="border-b border-line/60">
                  <td className="py-2 pr-4 text-muted">{InvoiceEmails.day(row.date)}</td>
                  <td className="py-2 pr-4">
                    {LEDGER_KIND[row.kind]}{" "}
                    <Link href={`/admin/invoices/${row.documentId}`} className="font-mono text-quant hover:underline">
                      {row.number}
                    </Link>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono tabular-nums">{row.debitMinor ? InvoiceMath.money(row.debitMinor, row.currency) : ""}</td>
                  <td className="py-2 pr-4 text-right font-mono text-emerald-300 tabular-nums">{row.creditMinor ? InvoiceMath.money(row.creditMinor, row.currency) : ""}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{InvoiceMath.money(row.balanceMinor, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      </section>

      <section id="documents" className="scroll-mt-16">
      <h2 className="mt-12 mb-4 text-lg">Documents</h2>
      {invoices.length === 0 ? (
        <p className="text-sm text-muted">No documents for this client yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line text-sm">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
              <Link href={`/admin/invoices/${invoice.id}`} className="font-mono text-quant hover:underline">
                {invoice.number ?? "Draft"}
              </Link>
              <span className="text-muted">{SettingsContract.DOCUMENT_TYPES[invoice.docType]}</span>
              <span className="text-muted">{InvoiceEmails.day(invoice.issueDate ?? invoice.dueDate)}</span>
              <span className="flex-1 text-right font-mono tabular-nums">{InvoiceMath.money(invoice.totalMinor, invoice.currency)}</span>
              <StatusBadge status={badgeFor(invoice, today)} />
            </li>
          ))}
        </ul>
      )}
      </section>

      <StudyPlanEditor clientId={client.id} items={plan} />

      <section id="mocks" className="mt-12 scroll-mt-16 rounded-lg border border-line p-5">
        <h2 className="text-lg">Mock exams</h2>
        <p className="mt-1 text-sm text-muted">Every attempt, retakes included, with their answers, flags and notes.</p>
        {mockAttempts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No mocks taken yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
            {mockAttempts.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
                <span className="flex-1">{a.mockTitle}</span>
                <span className="text-muted">{InvoiceEmails.day(Allowance.dateOf(a.startedAt.toISOString()))}</span>
                {a.score === null ? (
                  <span className="font-mono text-xs text-gold">In progress</span>
                ) : (
                  <>
                    <span className="font-mono tabular-nums">
                      {a.score}/{a.total} <span className="text-muted">({MockGrader.percent(a.score, a.total)}%)</span>
                    </span>
                    <Link href={`/admin/clients/${client.id}/mocks/${a.id}`} className="text-quant hover:underline">
                      Review
                    </Link>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="access" className="mt-12 scroll-mt-16 rounded-lg border border-line p-5">
        <h2 className="text-lg">Access</h2>
        <p className="mt-1 text-sm text-muted">Mocks and topic practice are granted separately. Ending access keeps their past results, and an attempt already started can be finished.</p>
        {accessGrants.length > 0 && (
          <ul className="mt-4 divide-y divide-line rounded-lg border border-line text-sm">
            {accessGrants.map((g) => {
              const live = !g.endsAt || g.endsAt > new Date();
              return (
                <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span>
                    <span className="font-medium">{g.product ? MockContract.PRODUCTS[g.product] : g.mockTitle}</span>
                    <span className="block font-mono text-xs text-muted">
                      {g.startsAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })} to {g.endsAt ? g.endsAt.toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" }) : "no end"} · {g.source}
                    </span>
                  </span>
                  {live ? (
                    <form action={endAccessGrant}>
                      <input type="hidden" name="clientId" value={client.id} />
                      <input type="hidden" name="grantId" value={g.id} />
                      <button type="submit" className="text-sm text-red-300 hover:underline">
                        End access
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-muted">Ended</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="mt-4">
          <AccessGrantForm clientId={client.id} mocks={grantableMocks} />
        </div>
      </section>

      <section id="classroom" className="mt-12 scroll-mt-16 rounded-lg border border-line p-5">
        <h2 className="text-lg">Google Classroom</h2>

        <form action={saveClassroomEmail} className="mt-4 flex flex-wrap items-end gap-3">
          <input type="hidden" name="clientId" value={client.id} />
          <label className="min-w-64 flex-1 text-sm">
            <span className="text-muted">Classroom email (only if they joined Classroom with another Google account)</span>
            <input name="classroomEmail" type="email" defaultValue={classroomEmail ?? ""} placeholder={client.email} className={`${FIELD} mt-1`} />
          </label>
          <PendingButton pendingLabel="Saving…" className="h-10 rounded-md border border-line px-4 text-sm hover:border-quant/60">
            Save
          </PendingButton>
        </form>
        <form action={previewWeeklyEmail} className="mt-3 text-sm">
          <input type="hidden" name="clientId" value={client.id} />
          <span className="text-muted">Sunday &ldquo;week in class&rdquo; email: </span>
          <PendingButton pendingLabel="Sending…" className="text-quant hover:underline">
            Email me a preview
          </PendingButton>
        </form>

        <h3 className="mt-5 text-sm font-semibold">Private classrooms (only this student)</h3>
        <p className="mt-1 text-sm text-muted">
          For mentorship and one-to-one subjects: create a class in Google Classroom, copy its invite link (Settings → Invite link) and add it here. It
          shows in their portal straight away, no request needed.
        </p>
        {privateClasses.length > 0 && (
          <ul className="mt-4 divide-y divide-line/60 text-sm">
            {privateClasses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1">
                  <a href={c.url} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                    {c.title}
                  </a>
                  {c.note && <span className="block text-xs text-muted">{c.note}</span>}
                </span>
                <form action={removePrivateClassroom}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="id" value={c.id} />
                  <PendingButton pendingLabel="Removing…" className="h-8 rounded-md border border-red-400/50 px-3 text-xs text-red-300 hover:bg-red-400/10">
                    Remove
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addPrivateClassroom} className="mt-4 grid items-end gap-3 sm:grid-cols-2">
          <input type="hidden" name="clientId" value={client.id} />
          <label className="text-xs text-muted">
            Class name
            <input name="title" required maxLength={120} placeholder="e.g. AP Statistics" className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted">
            Invite link
            <input name="url" required type="url" placeholder="https://classroom.google.com/c/…" className={`${FIELD} mt-1`} />
          </label>
          <label className="text-xs text-muted sm:col-span-2">
            One line for the student (optional)
            <input name="note" maxLength={160} placeholder="e.g. Your notes, homework and practice tests" className={`${FIELD} mt-1`} />
          </label>
          <PendingButton pendingLabel="Adding…" className="h-9 rounded-md bg-quant/15 px-4 text-sm font-medium text-quant hover:bg-quant/25 sm:justify-self-start">
            Add private classroom
          </PendingButton>
        </form>

        <h3 className="mt-8 border-t border-line pt-5 text-sm font-semibold">Course classrooms (shared with the batch)</h3>
        <p className="mt-1 text-sm text-muted">
          Exam courses (CFA, FRM) have one class per batch: pick theirs, and the class comes from that batch (Admin → Classroom → Batches). Other courses use the
          Classroom link on the course page. Their portal shows the invite only after you approve it here.
        </p>
        {classrooms.length === 0 ? (
          <p className="mt-4 text-sm text-muted">None of this client&rsquo;s courses has a Classroom yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line/60 text-sm">
            {classrooms.map((c) => (
              <li key={c.title} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                <span className="flex-1">
                  {c.title}
                  {c.batched && !c.hasClass && c.batch && c.batch !== Batches.NOT_SURE && <span className="ml-2 text-xs text-gold">batch has no class yet</span>}
                </span>
                {c.batched && (
                  <form action={setClientBatch} className="flex items-center gap-2">
                    <input type="hidden" name="clientId" value={client.id} />
                    <input type="hidden" name="course" value={c.title} />
                    <select name="batch" defaultValue={c.batch ?? ""} required aria-label={`${c.title} batch`} className="h-8 rounded-md border border-line bg-canvas px-2 text-xs">
                      <option value="" disabled>
                        Choose batch
                      </option>
                      {(batchCourses.find((b) => b.title === c.title)?.assignable ?? []).map((label) => (
                        <option key={label} value={label}>
                          {label}
                        </option>
                      ))}
                      <option value={Batches.NOT_SURE}>{Batches.NOT_SURE}</option>
                    </select>
                    <PendingButton pendingLabel="Saving…" className="h-8 rounded-md border border-line px-3 text-xs hover:bg-white/5">
                      Save
                    </PendingButton>
                  </form>
                )}
                <span className={`text-xs ${c.access === "requested" ? "font-semibold text-gold" : c.access === "approved" ? "text-quant" : "text-muted"}`}>
                  {{ none: "Not requested", requested: "Requested access", approved: "Has access", removed: "Access removed" }[c.access]}
                </span>
                <form action={decideClassroom}>
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="course" value={c.title} />
                  <input type="hidden" name="status" value={c.access === "approved" ? "removed" : "approved"} />
                  {c.access === "approved" ? (
                    <PendingButton pendingLabel="Removing…" className="h-8 rounded-md border border-red-400/50 px-3 text-xs text-red-300 hover:bg-red-400/10">
                      Remove access
                    </PendingButton>
                  ) : (
                    <PendingButton pendingLabel="Approving…" className="h-8 rounded-md bg-quant/15 px-3 text-xs font-medium text-quant hover:bg-quant/25">
                      Approve
                    </PendingButton>
                  )}
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <details id="details" className="mt-12 scroll-mt-16 rounded-lg border border-line p-5">
        <summary className="cursor-pointer text-sm text-quant">Edit details: name, contact, courses, payment plan</summary>
        <div className="mt-5">
          <ClientForm key={client.id} client={client} courses={courses.map((c) => c.title)} />
        </div>
      </details>

      <details className="mt-12 rounded-lg border border-red-400/30 p-5">
        <summary className="text-sm text-red-300/90">Delete this client…</summary>
        <p className="mt-3 text-sm text-muted">Their invoices are kept, with the details printed on them; they just stop being linked here.</p>
        <form action={deleteClient} className="mt-4">
          <input type="hidden" name="id" value={client.id} />
          <PendingButton pendingLabel="Deleting…" className="h-10 rounded-md border border-red-400/50 px-4 text-sm text-red-300 hover:bg-red-400/10">
            Delete client
          </PendingButton>
        </form>
      </details>
    </div>
  );
}
