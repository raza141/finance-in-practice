"use server";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";

import { InvoiceRepository } from "../server/InvoiceRepository";

/**
 * Called from the client's browser when the public invoice page opens. Public
 * by design (the token is the secret); your own admin views don't count.
 */
export async function recordInvoiceView(token: string): Promise<void> {
  if (!InvoiceRepository.isToken(token) || (await AdminAuth.current())) return;
  try {
    await InvoiceRepository.fromEnv()?.recordView(token);
  } catch (error) {
    console.error("[invoices] recording a view failed", error);
  }
}
