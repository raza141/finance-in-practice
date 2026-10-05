import "server-only";

import { randomBytes } from "node:crypto";

import { Database, type Sql } from "@/core/db/Database";

import { InvoiceMath } from "../services/InvoiceMath";
import type { Currency, EmailKind, EmailLogEntry, Invoice, InvoiceInput, InvoiceItem, InvoiceStatus, InvoiceSummary } from "../types";

interface InvoiceRow {
  id: string;
  number_seq: number | null;
  token: string;
  status: InvoiceStatus;
  booking_uid: string | null;
  client_name: string;
  client_email: string;
  currency: Currency;
  items: InvoiceItem[];
  subtotal_minor: number;
  discount_minor: number;
  tax_rate_bp: number;
  tax_minor: number;
  total_minor: number;
  trn: string;
  due_date: string;
  notes: string;
  payment_instructions: string;
  issue_date: string | null;
  created_at: Date;
  sent_at: Date | null;
  paid_at: Date | null;
  voided_at: Date | null;
}

interface EmailLogRow {
  id: string;
  kind: EmailKind;
  to_email: string;
  subject: string;
  invoice_id: string | null;
  booking_uid: string | null;
  provider_id: string | null;
  sent_at: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

/**
 * Postgres persistence for invoices and the email log (migration 012).
 * Content changes are only ever applied `WHERE status = 'draft'`: once issued,
 * an invoice is a frozen snapshot.
 */
export class InvoiceRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): InvoiceRepository | null {
    const sql = Database.sql();
    return sql ? new InvoiceRepository(sql) : null;
  }

  static isToken(value: unknown): value is string {
    return typeof value === "string" && TOKEN.test(value);
  }

  async list(): Promise<InvoiceSummary[]> {
    const rows = (await this.sql`
      SELECT i.id, i.number_seq, i.status, i.client_name, i.currency, i.total_minor,
             i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.created_at,
             (SELECT max(sent_at) FROM email_log e WHERE e.invoice_id = i.id) AS last_emailed_at
      FROM invoices i
      ORDER BY i.created_at DESC
      LIMIT 300
    `) as (Pick<InvoiceRow, "id" | "number_seq" | "status" | "client_name" | "currency" | "total_minor" | "issue_date" | "due_date" | "created_at"> & {
      last_emailed_at: Date | null;
    })[];
    return rows.map((row) => ({
      id: row.id,
      number: InvoiceRepository.number(row),
      status: row.status,
      clientName: row.client_name,
      currency: row.currency,
      totalMinor: row.total_minor,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      createdAt: row.created_at,
      lastEmailedAt: row.last_emailed_at,
    }));
  }

  async byId(id: string): Promise<Invoice | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`SELECT ${this.sql.unsafe(InvoiceRepository.COLUMNS)} FROM invoices WHERE id = ${id}`) as InvoiceRow[];
    return row ? InvoiceRepository.toInvoice(row) : null;
  }

  /** The client-facing view: issued invoices only (drafts stay private). */
  async byToken(token: string): Promise<Invoice | null> {
    if (!TOKEN.test(token)) return null;
    const [row] = (await this.sql`
      SELECT ${this.sql.unsafe(InvoiceRepository.COLUMNS)} FROM invoices WHERE token = ${token} AND status <> 'draft'
    `) as InvoiceRow[];
    return row ? InvoiceRepository.toInvoice(row) : null;
  }

  /** Prefill for a new invoice: the payment instructions used last time. */
  async lastPaymentInstructions(): Promise<string> {
    const [row] = (await this.sql`
      SELECT payment_instructions FROM invoices WHERE payment_instructions <> '' ORDER BY created_at DESC LIMIT 1
    `) as { payment_instructions: string }[];
    return row?.payment_instructions ?? "";
  }

  async createDraft(input: InvoiceInput): Promise<string> {
    const t = InvoiceRepository.totals(input);
    const [row] = (await this.sql`
      INSERT INTO invoices (token, booking_uid, client_name, client_email, currency, items, subtotal_minor,
                            discount_minor, tax_rate_bp, tax_minor, total_minor, trn, due_date, notes, payment_instructions)
      VALUES (${randomBytes(32).toString("base64url")}, ${input.bookingUid}, ${input.clientName}, ${input.clientEmail},
              ${input.currency}, ${JSON.stringify(input.items)}::jsonb, ${t.subtotalMinor}, ${t.discountMinor},
              ${input.taxRateBp}, ${t.taxMinor}, ${t.totalMinor}, ${input.trn}, ${input.dueDate}, ${input.notes},
              ${input.paymentInstructions})
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /** False when the invoice is gone or no longer a draft. */
  async updateDraft(id: string, input: InvoiceInput): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const t = InvoiceRepository.totals(input);
    const rows = await this.sql`
      UPDATE invoices SET
        booking_uid = ${input.bookingUid}, client_name = ${input.clientName}, client_email = ${input.clientEmail},
        currency = ${input.currency}, items = ${JSON.stringify(input.items)}::jsonb, subtotal_minor = ${t.subtotalMinor},
        discount_minor = ${t.discountMinor}, tax_rate_bp = ${input.taxRateBp}, tax_minor = ${t.taxMinor},
        total_minor = ${t.totalMinor}, trn = ${input.trn}, due_date = ${input.dueDate}, notes = ${input.notes},
        payment_instructions = ${input.paymentInstructions}, updated_at = now()
      WHERE id = ${id} AND status = 'draft'
      RETURNING id
    `;
    return rows.length > 0;
  }

  /**
   * Draft -> sent: draws the next number and freezes the content. The
   * sequence is only evaluated for the matched row, so a lost race or a
   * non-draft never burns a number.
   */
  async issue(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET
        status = 'sent', number_seq = nextval('invoice_number_seq')::int,
        issue_date = (now() AT TIME ZONE 'Asia/Dubai')::date, sent_at = now(), updated_at = now()
      WHERE id = ${id} AND status = 'draft'
      RETURNING id
    `;
    return rows.length > 0;
  }

  async markPaid(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now()
      WHERE id = ${id} AND status = 'sent' RETURNING id
    `;
    return rows.length > 0;
  }

  async void(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET status = 'void', voided_at = now(), updated_at = now()
      WHERE id = ${id} AND status = 'sent' RETURNING id
    `;
    return rows.length > 0;
  }

  /** Only drafts can be deleted: they hold no number, so nothing is skipped. */
  async deleteDraft(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`DELETE FROM invoices WHERE id = ${id} AND status = 'draft' RETURNING id`;
    return rows.length > 0;
  }

  async logEmail(entry: Omit<EmailLogEntry, "id" | "sentAt">): Promise<void> {
    await this.sql`
      INSERT INTO email_log (kind, to_email, subject, invoice_id, booking_uid, provider_id)
      VALUES (${entry.kind}, ${entry.toEmail}, ${entry.subject.slice(0, 300)}, ${entry.invoiceId}, ${entry.bookingUid}, ${entry.providerId})
    `;
  }

  /** Newest first; optionally only one invoice's emails. */
  async emails(invoiceId?: string): Promise<EmailLogEntry[]> {
    if (invoiceId !== undefined && !UUID.test(invoiceId)) return [];
    const rows = (
      invoiceId
        ? await this.sql`SELECT * FROM email_log WHERE invoice_id = ${invoiceId} ORDER BY sent_at DESC LIMIT 50`
        : await this.sql`SELECT * FROM email_log ORDER BY sent_at DESC LIMIT 30`
    ) as EmailLogRow[];
    return rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      toEmail: row.to_email,
      subject: row.subject,
      invoiceId: row.invoice_id,
      bookingUid: row.booking_uid,
      providerId: row.provider_id,
      sentAt: row.sent_at,
    }));
  }

  // Dates as text so they stay YYYY-MM-DD regardless of the server's timezone.
  private static readonly COLUMNS = `id, number_seq, token, status, booking_uid, client_name, client_email, currency, items,
    subtotal_minor, discount_minor, tax_rate_bp, tax_minor, total_minor, trn, due_date::text AS due_date, notes,
    payment_instructions, issue_date::text AS issue_date, created_at, sent_at, paid_at, voided_at`;

  private static totals(input: InvoiceInput) {
    return InvoiceMath.totals(
      input.items.map((item) => item.amountMinor),
      input.discountMinor,
      input.taxRateBp,
    );
  }

  private static number(row: Pick<InvoiceRow, "number_seq" | "issue_date">): string | null {
    return row.number_seq !== null && row.issue_date ? InvoiceMath.number(row.issue_date, row.number_seq) : null;
  }

  private static toInvoice(row: InvoiceRow): Invoice {
    return {
      id: row.id,
      number: InvoiceRepository.number(row),
      token: row.token,
      status: row.status,
      bookingUid: row.booking_uid,
      clientName: row.client_name,
      clientEmail: row.client_email,
      currency: row.currency,
      items: row.items,
      subtotalMinor: row.subtotal_minor,
      discountMinor: row.discount_minor,
      taxRateBp: row.tax_rate_bp,
      taxMinor: row.tax_minor,
      totalMinor: row.total_minor,
      trn: row.trn,
      dueDate: row.due_date,
      notes: row.notes,
      paymentInstructions: row.payment_instructions,
      issueDate: row.issue_date,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      paidAt: row.paid_at,
      voidedAt: row.voided_at,
    };
  }
}
