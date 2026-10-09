import "server-only";

import { QuoteDiff } from "../services/QuoteDiff";
import type { InvoiceInput } from "../types";
import type { InvoiceRepository } from "./InvoiceRepository";

/** What to confirm before an invoice is issued. Both lists empty = nothing to confirm. */
export interface IssueWarnings {
  /** Issued invoices to this client that already bill the same service for the same period. */
  duplicates: { number: string; code: string; period: string }[];
  /** Differences from the accepted quote the invoice came from. */
  deviations: string[];
  quoteNumber: string | null;
}

/**
 * Checks shown on an invoice draft and enforced when it is issued: a possible
 * double charge needs a reason, and terms that differ from the accepted quote
 * need an explicit confirmation (they were not approved by the client).
 */
export class IssueChecks {
  static readonly NONE: IssueWarnings = { duplicates: [], deviations: [], quoteNumber: null };

  static async for(repo: InvoiceRepository, id: string, doc: InvoiceInput): Promise<IssueWarnings> {
    if (doc.docType !== "invoice") return IssueChecks.NONE;
    const lines = doc.items.flatMap((item) => (item.serviceId && item.period ? [{ serviceId: item.serviceId, period: item.period }] : []));
    const [duplicates, quote] = await Promise.all([
      doc.clientId ? repo.alreadyBilled(doc.clientId, id, lines) : [],
      doc.relatedId ? repo.byId(doc.relatedId) : null,
    ]);
    const fromQuote = quote?.docType === "quote" ? quote : null;
    return { duplicates, deviations: fromQuote ? QuoteDiff.changes(fromQuote, doc) : [], quoteNumber: fromQuote?.number ?? null };
  }

  /** Why issuing must wait, or null: a double charge without a reason, or quote changes not confirmed. */
  static blocked(warnings: IssueWarnings, duplicateReason: string, deviationsConfirmed: boolean): string | null {
    if (warnings.duplicates.length > 0 && !duplicateReason) return "This client was already invoiced for the same service and period: give a reason to bill it again.";
    if (warnings.deviations.length > 0 && !deviationsConfirmed) return "This invoice differs from the accepted quote: confirm the changes to issue it.";
    return null;
  }
}
