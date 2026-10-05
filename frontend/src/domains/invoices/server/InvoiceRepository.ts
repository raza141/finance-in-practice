import "server-only";

import { randomBytes } from "node:crypto";

import { Database, type Sql } from "@/core/db/Database";

import { InvoiceMath } from "../services/InvoiceMath";
import type { BankDetails, Currency, CurrencyStats, EmailKind, InvoiceDashboard, EmailLogEntry, Invoice, InvoiceInput, InvoiceItem, InvoiceStatus, InvoiceSummary } from "../types";

interface InvoiceRow {
  id: string;
  number_seq: number | null;
  token: string;
  status: InvoiceStatus;
  booking_uid: string | null;
  client_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  client_address: string;
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
  bank_account_id: string | null;
  bank: BankDetails | null;
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

type SummaryRow = Pick<InvoiceRow, "id" | "number_seq" | "status" | "client_name" | "currency" | "total_minor" | "issue_date" | "due_date" | "created_at"> & {
  last_emailed_at: Date | null;
};

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

  /** Newest first; optionally only one saved client's invoices. */
  async list(clientId?: string): Promise<InvoiceSummary[]> {
    if (clientId !== undefined && !UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT i.id, i.number_seq, i.status, i.client_name, i.currency, i.total_minor,
             i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.created_at,
             (SELECT max(sent_at) FROM email_log e WHERE e.invoice_id = i.id) AS last_emailed_at
      FROM invoices i
      WHERE ${clientId ?? null}::uuid IS NULL OR i.client_id = ${clientId ?? null}::uuid
      ORDER BY i.created_at DESC
      LIMIT 300
    `) as SummaryRow[];
    return rows.map(InvoiceRepository.toSummary);
  }

  /** Issued, unpaid invoices, the longest overdue first. */
  async awaitingPayment(limit = 6): Promise<InvoiceSummary[]> {
    const rows = (await this.sql`
      SELECT i.id, i.number_seq, i.status, i.client_name, i.currency, i.total_minor,
             i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.created_at,
             (SELECT max(sent_at) FROM email_log e WHERE e.invoice_id = i.id) AS last_emailed_at
      FROM invoices i
      WHERE i.status = 'sent'
      ORDER BY i.due_date, i.created_at
      LIMIT ${limit}
    `) as SummaryRow[];
    return rows.map(InvoiceRepository.toSummary);
  }

  /**
   * Money figures for the admin dashboard, per currency (amounts in different
   * currencies are never added together). "This month" is the Dubai calendar
   * month; income counts when an invoice is marked paid.
   */
  async dashboard(): Promise<InvoiceDashboard> {
    const [currencies, [counts], months] = await Promise.all([
      this.sql`
        WITH bounds AS (
          SELECT date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') AT TIME ZONE 'Asia/Dubai' AS this_month,
                 (date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') - interval '1 month') AT TIME ZONE 'Asia/Dubai' AS last_month,
                 (now() AT TIME ZONE 'Asia/Dubai')::date AS today
        )
        SELECT i.currency,
          coalesce(sum(i.total_minor) FILTER (WHERE i.status = 'paid' AND i.paid_at >= b.this_month), 0)::bigint AS paid_this_month,
          coalesce(sum(i.total_minor) FILTER (WHERE i.status = 'paid' AND i.paid_at >= b.last_month AND i.paid_at < b.this_month), 0)::bigint AS paid_last_month,
          count(*) FILTER (WHERE i.status = 'sent') AS pending_count,
          coalesce(sum(i.total_minor) FILTER (WHERE i.status = 'sent'), 0)::bigint AS pending_minor,
          count(*) FILTER (WHERE i.status = 'sent' AND i.due_date < b.today) AS overdue_count,
          coalesce(sum(i.total_minor) FILTER (WHERE i.status = 'sent' AND i.due_date < b.today), 0)::bigint AS overdue_minor
        FROM invoices i CROSS JOIN bounds b
        WHERE i.status <> 'draft'
        GROUP BY i.currency
        ORDER BY i.currency
      `,
      this.sql`SELECT count(*) FILTER (WHERE status = 'draft') AS drafts FROM invoices`,
      this.sql`
        SELECT to_char(paid_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM') AS month, currency, sum(total_minor)::bigint AS total
        FROM invoices
        WHERE status = 'paid'
          AND paid_at >= (date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') - interval '5 months') AT TIME ZONE 'Asia/Dubai'
        GROUP BY 1, 2
      `,
    ]);
    // count/sum come back as strings (bigint).
    return {
      currencies: (currencies as Record<string, string>[]).map(
        (row): CurrencyStats => ({
          currency: row.currency as Currency,
          paidThisMonthMinor: Number(row.paid_this_month),
          paidLastMonthMinor: Number(row.paid_last_month),
          pendingCount: Number(row.pending_count),
          pendingMinor: Number(row.pending_minor),
          overdueCount: Number(row.overdue_count),
          overdueMinor: Number(row.overdue_minor),
        }),
      ),
      drafts: Number((counts as { drafts: string }).drafts),
      paidByMonth: (months as Record<string, string>[]).map((row) => ({ month: row.month, currency: row.currency as Currency, totalMinor: Number(row.total) })),
    };
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

  /** `bank` is the snapshot of input.bankAccountId, looked up by the caller. */
  async createDraft(input: InvoiceInput, bank: BankDetails | null): Promise<string> {
    const t = InvoiceRepository.totals(input);
    const [row] = (await this.sql`
      INSERT INTO invoices (token, booking_uid, client_id, client_name, client_email, client_phone, client_address,
                            currency, items, subtotal_minor, discount_minor, tax_rate_bp, tax_minor, total_minor, trn,
                            due_date, notes, payment_instructions, bank_account_id, bank)
      VALUES (${randomBytes(32).toString("base64url")}, ${input.bookingUid}, ${input.clientId}, ${input.clientName},
              ${input.clientEmail}, ${input.clientPhone}, ${input.clientAddress}, ${input.currency},
              ${JSON.stringify(input.items)}::jsonb, ${t.subtotalMinor}, ${t.discountMinor}, ${input.taxRateBp},
              ${t.taxMinor}, ${t.totalMinor}, ${input.trn}, ${input.dueDate}, ${input.notes},
              ${input.paymentInstructions}, ${input.bankAccountId}, ${bank && JSON.stringify(bank)}::jsonb)
      RETURNING id
    `) as { id: string }[];
    return row.id;
  }

  /** False when the invoice is gone or no longer a draft. */
  async updateDraft(id: string, input: InvoiceInput, bank: BankDetails | null): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const t = InvoiceRepository.totals(input);
    const rows = await this.sql`
      UPDATE invoices SET
        booking_uid = ${input.bookingUid}, client_id = ${input.clientId}, client_name = ${input.clientName},
        client_email = ${input.clientEmail}, client_phone = ${input.clientPhone}, client_address = ${input.clientAddress},
        currency = ${input.currency}, items = ${JSON.stringify(input.items)}::jsonb, subtotal_minor = ${t.subtotalMinor},
        discount_minor = ${t.discountMinor}, tax_rate_bp = ${input.taxRateBp}, tax_minor = ${t.taxMinor},
        total_minor = ${t.totalMinor}, trn = ${input.trn}, due_date = ${input.dueDate}, notes = ${input.notes},
        payment_instructions = ${input.paymentInstructions}, bank_account_id = ${input.bankAccountId},
        bank = ${bank && JSON.stringify(bank)}::jsonb, updated_at = now()
      WHERE id = ${id} AND status = 'draft'
      RETURNING id
    `;
    return rows.length > 0;
  }

  /**
   * Draft -> sent: draws the next number and freezes the content. The row is
   * locked (FOR UPDATE) before nextval runs, so a concurrent issue of the same
   * draft waits, finds it no longer a draft and matches nothing: a lost race
   * never burns a number.
   */
  async issue(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET
        status = 'sent', number_seq = nextval('invoice_number_seq')::int,
        issue_date = (now() AT TIME ZONE 'Asia/Dubai')::date, sent_at = now(), updated_at = now()
      WHERE id = (SELECT id FROM invoices WHERE id = ${id} AND status = 'draft' FOR UPDATE)
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
  private static readonly COLUMNS = `id, number_seq, token, status, booking_uid, client_id, client_name, client_email,
    client_phone, client_address, currency, items, subtotal_minor, discount_minor, tax_rate_bp, tax_minor, total_minor,
    trn, due_date::text AS due_date, notes, payment_instructions, bank_account_id, bank, issue_date::text AS issue_date, created_at, sent_at, paid_at, voided_at`;

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

  private static toSummary(row: SummaryRow): InvoiceSummary {
    return {
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
    };
  }

  private static toInvoice(row: InvoiceRow): Invoice {
    return {
      id: row.id,
      number: InvoiceRepository.number(row),
      token: row.token,
      status: row.status,
      bookingUid: row.booking_uid,
      clientId: row.client_id,
      clientName: row.client_name,
      clientEmail: row.client_email,
      clientPhone: row.client_phone,
      clientAddress: row.client_address,
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
      bankAccountId: row.bank_account_id,
      bank: row.bank,
      issueDate: row.issue_date,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      paidAt: row.paid_at,
      voidedAt: row.voided_at,
    };
  }
}
