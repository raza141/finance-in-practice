import { SettingsContract } from "@/domains/settings/services/SettingsContract";

import type { Invoice, InvoiceStatus } from "../types";

type Doc = Pick<Invoice, "docType" | "status" | "trn" | "dueDate">;

/** Titles, derived statuses and file names for billing documents. Pure. */
export class DocumentFormat {
  /** "Invoice", "Quote"…; a quote that carries agreement terms is an "Agreement" (number stays FIP-QUO). */
  static label(doc: Pick<Invoice, "docType"> & { agreement?: Invoice["agreement"] }): string {
    return doc.docType === "quote" && doc.agreement ? "Agreement" : SettingsContract.DOCUMENT_TYPES[doc.docType];
  }

  /** The printed title. A document issued with a TRN and VAT is a tax document; quotes never are. */
  static title(doc: Pick<Invoice, "docType" | "trn" | "taxRateBp"> & { agreement?: Invoice["agreement"] }): string {
    const label = DocumentFormat.label(doc);
    return doc.trn && doc.taxRateBp > 0 && doc.docType !== "quote" ? `Tax ${label.toLowerCase()}` : label;
  }

  /** A sent quote past its valid-until date. */
  static isExpired(doc: Doc, today: string): boolean {
    return doc.docType === "quote" && doc.status === "sent" && doc.dueDate < today;
  }

  /** The stamp beside the number. Issued, open documents carry none. */
  static stamp(doc: Doc, today: string): string | null {
    if (DocumentFormat.isExpired(doc, today)) return "expired";
    if (doc.docType === "receipt" && doc.status === "paid") return null;
    return doc.status === "sent" ? null : doc.status;
  }

  /** What is still owed on an invoice after payments and credit notes. */
  static balance(doc: Pick<Invoice, "totalMinor" | "paidMinor" | "creditedMinor">): number {
    return Math.max(0, doc.totalMinor - doc.paidMinor - doc.creditedMinor);
  }

  /** How much of an invoice can still be credited: its total less earlier credit notes. */
  static creditable(doc: Pick<Invoice, "totalMinor" | "creditedMinor">): number {
    return Math.max(0, doc.totalMinor - doc.creditedMinor);
  }

  /** "Invoice-FIP-INV-2026-0002-Khawla-Abdullah", the saved PDF's name (the page title). */
  static filename(doc: Pick<Invoice, "docType" | "number" | "clientName"> & { agreement?: Invoice["agreement"] }): string {
    const type = DocumentFormat.label(doc).replace(/\s+/g, "-");
    const client = doc.clientName.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    return [type, doc.number ?? "Draft", client].filter(Boolean).join("-");
  }

  /** Status words for the admin: "sent" reads as Issued. */
  static statusLabel(status: InvoiceStatus): string {
    return status === "sent" ? "issued" : status;
  }
}
