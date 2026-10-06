import "server-only";

import { randomBytes } from "node:crypto";

import { Database, type Sql } from "@/core/db/Database";

import { InvoiceMath } from "../services/InvoiceMath";
import type { BankDetails, Currency, CurrencyStats, EmailKind, InvoiceDashboard, EmailLogEntry, Invoice, InvoiceInput, InvoiceItem, InvoicePayment, InvoiceStatus, InvoiceSummary } from "../types";

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
  paid_minor: number;
  payments: InvoicePayment[];
  view_count: number;
  first_viewed_at: Date | null;
  last_viewed_at: Date | null;
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

type SummaryRow = Pick<InvoiceRow, "id" | "number_seq" | "status" | "client_name" | "currency" | "total_minor" | "issue_date" | "due_date" | "created_at" | "first_viewed_at" | "paid_minor"> & {
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
             i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.created_at, i.first_viewed_at,
             (SELECT coalesce(sum(amount_minor), 0)::int FROM invoice_payments p WHERE p.invoice_id = i.id) AS paid_minor,
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
             i.issue_date::text AS issue_date, i.due_date::text AS due_date, i.created_at, i.first_viewed_at,
             (SELECT coalesce(sum(amount_minor), 0)::int FROM invoice_payments p WHERE p.invoice_id = i.id) AS paid_minor,
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
   * month; income counts on the day each payment arrived, so an advance and
   * the balance land in their own months.
   */
  async dashboard(): Promise<InvoiceDashboard> {
    const [currencies, [counts], months] = await Promise.all([
      this.sql`
        WITH b AS (
          SELECT (now() AT TIME ZONE 'Asia/Dubai')::date AS today, date_trunc('month', now() AT TIME ZONE 'Asia/Dubai')::date AS this_month
        ), paid AS (
          SELECT i.currency, p.amount_minor, p.paid_on FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
        ), open AS (
          SELECT i.currency, i.due_date,
                 i.total_minor - coalesce((SELECT sum(amount_minor) FROM invoice_payments p WHERE p.invoice_id = i.id), 0) AS balance
          FROM invoices i WHERE i.status = 'sent'
        )
        SELECT c.currency,
          coalesce((SELECT sum(amount_minor) FROM paid, b WHERE paid.currency = c.currency AND paid_on >= b.this_month), 0)::bigint AS paid_this_month,
          coalesce((SELECT sum(amount_minor) FROM paid, b
                    WHERE paid.currency = c.currency AND paid_on >= (b.this_month - interval '1 month')::date AND paid_on < b.this_month), 0)::bigint AS paid_last_month,
          (SELECT count(*) FROM open WHERE open.currency = c.currency) AS pending_count,
          coalesce((SELECT sum(balance) FROM open WHERE open.currency = c.currency), 0)::bigint AS pending_minor,
          (SELECT count(*) FROM open, b WHERE open.currency = c.currency AND due_date < b.today) AS overdue_count,
          coalesce((SELECT sum(balance) FROM open, b WHERE open.currency = c.currency AND due_date < b.today), 0)::bigint AS overdue_minor
        FROM (SELECT DISTINCT currency FROM invoices WHERE status <> 'draft') c
        ORDER BY c.currency
      `,
      this.sql`SELECT count(*) FILTER (WHERE status = 'draft') AS drafts FROM invoices`,
      this.sql`
        SELECT to_char(p.paid_on, 'YYYY-MM') AS month, i.currency, sum(p.amount_minor)::bigint AS total
        FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
        WHERE p.paid_on >= (date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') - interval '5 months')::date
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

  /** Counts a client opening the invoice link. Drafts have no public page, so they never count. */
  async recordView(token: string): Promise<void> {
    if (!TOKEN.test(token)) return;
    await this.sql`
      UPDATE invoices SET view_count = view_count + 1, first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
      WHERE token = ${token} AND status <> 'draft'
    `;
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

  /**
   * Records money received. Refuses more than the balance; the payment that
   * clears it marks the invoice paid. Returns null when refused.
   * ponytail: the balance is read once per statement, so two admins paying the same invoice at the same instant could overpay; fine for one admin.
   */
  async addPayment(id: string, payment: Omit<InvoicePayment, "id">): Promise<"recorded" | "settled" | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      WITH inv AS (
        SELECT i.id, i.total_minor - coalesce((SELECT sum(amount_minor) FROM invoice_payments p WHERE p.invoice_id = i.id), 0) AS balance
        FROM invoices i WHERE i.id = ${id} AND i.status = 'sent' FOR UPDATE
      ), ins AS (
        INSERT INTO invoice_payments (invoice_id, amount_minor, paid_on, note)
        SELECT id, ${payment.amountMinor}::int, ${payment.paidOn}::date, ${payment.note}::text FROM inv WHERE ${payment.amountMinor}::int <= balance
        RETURNING invoice_id
      ), settle AS (
        UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now()
        WHERE id IN (SELECT invoice_id FROM ins) AND (SELECT balance FROM inv) = ${payment.amountMinor}::int
        RETURNING id
      )
      SELECT (SELECT count(*) FROM ins)::int AS recorded, (SELECT count(*) FROM settle)::int AS settled
    `) as { recorded: number; settled: number }[];
    return row.settled ? "settled" : row.recorded ? "recorded" : null;
  }

  /** "Mark as paid": records whatever is still due as received today (Dubai), and marks the invoice paid. */
  async markPaid(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      WITH inv AS (
        SELECT i.id, i.total_minor,
               i.total_minor - coalesce((SELECT sum(amount_minor) FROM invoice_payments p WHERE p.invoice_id = i.id), 0) AS balance
        FROM invoices i WHERE i.id = ${id} AND i.status = 'sent' FOR UPDATE
      ), ins AS (
        INSERT INTO invoice_payments (invoice_id, amount_minor, paid_on, note)
        SELECT id, balance, (now() AT TIME ZONE 'Asia/Dubai')::date, CASE WHEN balance = total_minor THEN 'Paid in full' ELSE 'Balance' END
        FROM inv WHERE balance > 0
      )
      UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now() WHERE id IN (SELECT id FROM inv) RETURNING id
    `;
    return rows.length > 0;
  }

  /** Undoes a payment recorded by mistake; a paid invoice goes back to awaiting payment. */
  async removePayment(invoiceId: string, paymentId: string): Promise<boolean> {
    if (!UUID.test(invoiceId) || !UUID.test(paymentId)) return false;
    const [row] = (await this.sql`
      WITH del AS (
        DELETE FROM invoice_payments p USING invoices i
        WHERE p.id = ${paymentId} AND p.invoice_id = ${invoiceId} AND i.id = p.invoice_id AND i.status IN ('sent', 'paid')
        RETURNING p.invoice_id
      ), reopen AS (
        UPDATE invoices SET status = 'sent', paid_at = NULL, updated_at = now()
        WHERE id IN (SELECT invoice_id FROM del) AND status = 'paid'
        RETURNING id
      )
      SELECT (SELECT count(*) FROM del)::int AS removed
    `) as { removed: number }[];
    return row.removed > 0;
  }

  async void(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET status = 'void', voided_at = now(), updated_at = now()
      WHERE id = ${id} AND status = 'sent' AND NOT EXISTS (SELECT 1 FROM invoice_payments WHERE invoice_id = ${id})
      RETURNING id
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
    trn, due_date::text AS due_date, notes, payment_instructions, bank_account_id, bank, issue_date::text AS issue_date, created_at, sent_at, paid_at, voided_at,
    view_count, first_viewed_at, last_viewed_at,
    (SELECT coalesce(sum(amount_minor), 0)::int FROM invoice_payments p WHERE p.invoice_id = invoices.id) AS paid_minor,
    (SELECT coalesce(json_agg(json_build_object('id', p.id, 'amountMinor', p.amount_minor, 'paidOn', p.paid_on::text, 'note', p.note)
       ORDER BY p.paid_on, p.created_at), '[]') FROM invoice_payments p WHERE p.invoice_id = invoices.id) AS payments`;

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
      firstViewedAt: row.first_viewed_at,
      paidMinor: row.paid_minor,
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
      paidMinor: row.paid_minor,
      payments: row.payments,
      viewCount: row.view_count,
      firstViewedAt: row.first_viewed_at,
      lastViewedAt: row.last_viewed_at,
    };
  }
}
