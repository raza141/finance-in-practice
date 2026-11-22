"use server";

import { ResendClient } from "@/core/email/ResendClient";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { AccountabilityRepository } from "../server/AccountabilityRepository";
import { CheckInEmail } from "../services/CheckInEmail";
import type { FormResult } from "../types";

/**
 * Sends one reviewed check-in. Owner only; the address comes from the student's record, never the form.
 * ponytail: nothing records what was sent, so a reload could send twice; a check-ins table if that happens.
 */
export async function sendCheckIn(clientId: string, _: FormResult, form: FormData): Promise<FormResult> {
  await AdminAuth.requireOwner();
  const parsed = CheckInEmail.parse(form);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const [facts] = (await AccountabilityRepository.fromEnv()?.facts(String(clientId))) ?? [];
  if (!facts?.goal.live || !facts.goal.email) return { ok: false, message: "That student has no open plan or no email." };
  const resend = ResendClient.fromEnv();
  if (!resend) return { ok: false, message: "Email isn't set up here." };
  try {
    await resend.send(facts.goal.email, CheckInEmail.message(parsed.value));
  } catch (error) {
    console.error("accountability: check-in not sent", error);
    return { ok: false, message: "Couldn't send. Try again in a minute." };
  }
  return { ok: true, message: "Sent." };
}
