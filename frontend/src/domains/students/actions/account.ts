"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ZonedCalendar } from "@/domains/booking/services/ZonedCalendar";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { InvoiceContract } from "@/domains/invoices/services/InvoiceContract";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { TermsRepository } from "@/domains/settings/server/TermsRepository";

import { HourRequestRepository } from "../server/HourRequestRepository";
import { OwnerNotice } from "../server/OwnerNotice";
import { StudentAuth } from "../server/StudentAuth";
import { Allowance } from "../services/Allowance";
import { HourRequestContract } from "../services/HourRequestContract";
import type { HourRequestStatus } from "../types";

/** The Hours & payments tab's own actions (signed-in student), and the owner's answer to a request. */

export interface AccountActionState {
  ok?: boolean;
  error?: string;
}

const thisAndNextMonth = () => {
  const today = new ZonedCalendar(InvoiceContract.DEFAULT_TIME_ZONE).today();
  return [today.slice(0, 7), InvoiceMath.addMonths(`${today.slice(0, 7)}-01`, 1).slice(0, 7)];
};

/** A student who used their month's hours asks for more; the owner gets an email and answers in admin Clients. */
export async function requestHours(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const student = await StudentAuth.current();
  if (!student) return { error: "Please sign in again." };
  const parsed = HourRequestContract.parse(Object.fromEntries(formData), thisAndNextMonth());
  if (!parsed.ok) return { error: parsed.error };
  const agreements = (await AgreementRepository.fromEnv()?.forClient(student.id)) ?? [];
  const agreement = Allowance.covering(agreements, parsed.value.month);
  if (!agreement) return { error: "Your agreement doesn't include monthly hours. Message your instructor." };
  const repo = HourRequestRepository.fromEnv();
  if (!repo) return { error: "Requests are not available right now." };
  if (!(await repo.create(student.id, agreement.id, parsed.value.month, parsed.value.hours, parsed.value.note))) {
    return { error: "You already asked for more hours this month: your instructor will answer soon." };
  }
  await OwnerNotice.send(
    `More hours: ${student.name} asks for ${parsed.value.hours} h`,
    "Request for more hours",
    [
      ["Student", student.name],
      ["Agreement", `${agreement.serviceName}, ${agreement.hoursPerMonth} h a month`],
      ["Month", parsed.value.month],
      ["Extra hours", String(parsed.value.hours)],
      ["Note", parsed.value.note || "–"],
    ],
    student.id,
  );
  refresh();
  return { ok: true };
}

/** The student accepts their agreement, with the terms and conditions (no signature needed). */
export async function acceptAgreement(_: AccountActionState, formData: FormData): Promise<AccountActionState> {
  const student = await StudentAuth.current();
  if (!student) return { error: "Please sign in again." };
  if (formData.get("acceptTerms") !== "yes") return { error: "Please tick that you accept the terms and conditions." };
  const terms = TermsRepository.fromEnv();
  const agreements = AgreementRepository.fromEnv();
  if (!terms || !agreements) return { error: "Not available right now. Please try again later." };
  const id = String(formData.get("agreementId"));
  const version = await terms.latest();
  if (!(await agreements.accept(student.id, id, version?.id ?? null))) return { error: "This agreement was already accepted or has ended." };
  await terms.accept(student.id);
  const agreement = (await agreements.forClient(student.id)).find((a) => a.id === id);
  await OwnerNotice.send(
    `Agreement accepted: ${student.name}`,
    "Agreement accepted in the portal",
    [
      ["Student", student.name],
      ["Agreement", agreement ? `${agreement.serviceName}, ${InvoiceMath.money(agreement.rateMinor, agreement.currency)} ${InvoiceContract.UNITS[agreement.unit].toLowerCase()}` : id],
    ],
    student.id,
  );
  refresh();
  return { ok: true };
}

/** The student accepts the current terms and conditions (after an update, or if they registered before terms were asked). */
export async function acceptTerms(): Promise<void> {
  const student = await StudentAuth.current();
  if (!student) return;
  await TermsRepository.fromEnv()?.accept(student.id);
  refresh();
}

const DECISIONS: readonly Exclude<HourRequestStatus, "pending">[] = ["free", "billed", "declined"];

/** Owner: approve extra hours as included, as extra to pay, or decline. */
export async function decideHourRequest(formData: FormData): Promise<void> {
  await AdminAuth.requireOwner();
  const clientId = String(formData.get("clientId"));
  const status = String(formData.get("status")) as Exclude<HourRequestStatus, "pending">;
  if (DECISIONS.includes(status)) await HourRequestRepository.fromEnv()?.decide(clientId, String(formData.get("requestId")), status);
  redirect(`/admin/clients/${clientId}?notice=hours-saved#sessions`);
}
