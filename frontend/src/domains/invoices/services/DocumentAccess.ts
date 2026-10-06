import type { Invoice } from "../types";

const DAY = 24 * 60 * 60 * 1000;

/**
 * How long a client link works: until the document is settled plus 30 days,
 * never less than 90 days from issue, and longer when renewed ("Resend link").
 * An unpaid invoice or an open quote never expires. Pure.
 */
export class DocumentAccess {
  /** When the link stops working, or null while it stays open. */
  static expiresAt(doc: Pick<Invoice, "docType" | "status" | "sentAt" | "paidAt" | "voidedAt" | "dueDate" | "linkValidUntil">): Date | null {
    if (!doc.sentAt) return null;
    const closedAt =
      doc.status === "paid"
        ? doc.paidAt
        : doc.status === "void"
          ? doc.voidedAt
          : doc.docType === "receipt" || doc.docType === "credit_note"
            ? doc.sentAt
            : doc.docType === "quote"
              ? new Date(`${doc.dueDate}T23:59:59+04:00`)
              : null;
    if (!closedAt) return null;
    const times = [doc.sentAt.getTime() + 90 * DAY, closedAt.getTime() + 30 * DAY, doc.linkValidUntil?.getTime() ?? 0];
    return new Date(Math.max(...times));
  }

  static isExpired(doc: Parameters<typeof DocumentAccess.expiresAt>[0], now = new Date()): boolean {
    const expires = DocumentAccess.expiresAt(doc);
    return expires !== null && now > expires;
  }
}
