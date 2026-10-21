import { revalidatePath } from "next/cache";
import type { NextRequest } from "next/server";

import { RequestGuard } from "@/core/http/RequestGuard";
import { SlidingWindowRateLimiter } from "@/domains/booking/server/SlidingWindowRateLimiter";
import { AgreementRepository } from "@/domains/invoices/server/AgreementRepository";
import { InvoiceRepository } from "@/domains/invoices/server/InvoiceRepository";
import { DocumentAccess } from "@/domains/invoices/services/DocumentAccess";
import { InvoiceMath } from "@/domains/invoices/services/InvoiceMath";
import { QuoteAgreements } from "@/domains/invoices/services/QuoteAgreements";
import { TermsRepository } from "@/domains/settings/server/TermsRepository";
import { OwnerNotice } from "@/domains/students/server/OwnerNotice";

const NO_STORE = { "Cache-Control": "no-store" };

// 5 attempts per IP per 10 minutes (per warm instance).
const limiter = new SlidingWindowRateLimiter(5, 10 * 60_000);

const reject = (status: number, message: string) => Response.json({ message }, { status, headers: NO_STORE });

/**
 * POST /api/quote/accept  { token, name, acceptTerms: true }
 * The client accepts a sent quote from its link, with the terms and conditions
 * (no signature). An agreement quote for a saved client creates their client
 * agreement; a revision ends the agreement of the version it replaces.
 */
export async function POST(request: NextRequest) {
  if (!RequestGuard.isSameOrigin(request)) return reject(403, "Cross-origin requests are not allowed.");
  if (!limiter.allow(RequestGuard.clientIp(request))) return reject(429, "Too many attempts. Please wait a few minutes.");
  let body: { token?: unknown; name?: unknown; acceptTerms?: unknown };
  try {
    body = await request.json();
  } catch {
    return reject(400, "Body must be valid JSON.");
  }
  const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2 || name.length > 120) return reject(400, "Type your full name to accept.");
  if (body.acceptTerms !== true) return reject(400, "Please tick that you accept the terms and conditions.");

  const repo = InvoiceRepository.fromEnv();
  const agreements = AgreementRepository.fromEnv();
  const terms = TermsRepository.fromEnv();
  if (!repo || !agreements || !terms || !InvoiceRepository.isToken(body.token)) return reject(404, "This quote can't be found.");
  const quote = await repo.byToken(body.token);
  if (!quote || quote.docType !== "quote" || DocumentAccess.isExpired(quote)) return reject(404, "This quote can't be found.");
  if (quote.status === "accepted") return Response.json({ ok: true, already: true }, { headers: NO_STORE });
  if (quote.status !== "sent") return reject(409, "This quote can no longer be accepted. Please ask for a new one.");

  const version = await terms.latest();
  const accepted = await repo.acceptQuote(
    quote.id,
    {
      acceptedAt: new Date(),
      approver: name,
      method: "online",
      notes: `Accepted online from the quote link, with the terms and conditions${version ? ` published ${version.createdAt.toISOString().slice(0, 10)}` : ""}.`,
      evidenceUrl: null,
    },
    `client (online): ${name}`,
  );
  if (!accepted) return reject(409, "This quote has expired. Please ask for a new one.");

  // The agreement, for a saved client: created already accepted; a revision replaces the earlier version's.
  let outcome = "No agreement block: nothing else to set up.";
  if (quote.agreement && quote.clientId) {
    const built = QuoteAgreements.toAgreement(quote);
    if (!built.ok) outcome = built.reason;
    else if (await agreements.createFromQuote(quote.clientId, built.input, quote.id, version?.id ?? null)) {
      if (quote.supersedesId) await agreements.archiveFromQuote(quote.clientId, quote.supersedesId);
      outcome = "Their agreement was created from it and shows in their portal.";
    } else outcome = "The agreement couldn't be created (the service doesn't offer that basis). Add it by hand in Clients.";
    await terms.accept(quote.clientId);
  } else if (quote.agreement) outcome = "The quote isn't linked to a saved client, so no agreement was created. Add it by hand in Clients.";

  if (quote.clientId) {
    await OwnerNotice.send(
      `Quote accepted online: ${quote.number ?? ""} by ${name}`,
      "Quote accepted online",
      [
        ["Quote", quote.number ?? quote.id],
        ["Accepted by", name],
        ["Total", InvoiceMath.money(quote.totalMinor, quote.currency)],
        ["Agreement", outcome],
      ],
      quote.clientId,
    );
  }
  revalidatePath(`/invoice/${quote.token}`);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
