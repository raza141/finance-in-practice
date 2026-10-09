import "server-only";

import { randomBytes } from "node:crypto";

import { Database, type Sql } from "@/core/db/Database";

import { InvoiceMath } from "../services/InvoiceMath";
import type {
  BankDetails,
  ConsultancySections,
  Currency,
  CurrencyStats,
  DocumentEvent,
  DocumentLayout,
  DocumentType,
  EmailKind,
  EmailLogEntry,
  Invoice,
  InvoiceDashboard,
  InvoiceInput,
  InvoiceItem,
  InvoicePayment,
  InvoiceStatus,
  InvoiceSummary,
  LedgerEntry,
  PaymentTerms,
} from "../types";

interface InvoiceRow {
  id: string;
  doc_type: DocumentType;
  number_seq: number | null;
  number: string | null;
  related_id: string | null;
  related_number: string | null;
  payment_id: string | null;
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
  payment_terms: PaymentTerms;
  terms_days: number | null;
  payment_link: string;
  layout: DocumentLayout;
  sections: Partial<ConsultancySections>;
  recurring: boolean;
  recurs_from: string | null;
  link_valid_until: Date | null;
  issue_date: string | null;
  created_at: Date;
  sent_at: Date | null;
  paid_at: Date | null;
  voided_at: Date | null;
  paid_minor: number;
  credited_minor: number;
  payments: InvoicePayment[];
  receipt_payment: InvoicePayment | null;
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

type SummaryRow = Pick<
  InvoiceRow,
  "id" | "doc_type" | "number_seq" | "number" | "status" | "client_name" | "currency" | "total_minor" | "issue_date" | "due_date" | "created_at" | "first_viewed_at" | "paid_minor" | "credited_minor"
> & { last_emailed_at: Date | null };

/** A payment as recorded: amount and date, how it was paid, and optional proof. */
export type PaymentRecord = Omit<InvoicePayment, "id" | "receiptId"> & { submissionKey: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Money against a document, as SQL over the row aliased `d`. Credit notes count once issued.
const PAID = `(SELECT coalesce(sum(p.amount_minor), 0) FROM invoice_payments p WHERE p.invoice_id = d.id)`;
const CREDITED = `(SELECT coalesce(sum(c.total_minor), 0) FROM invoices c WHERE c.related_id = d.id AND c.doc_type = 'credit_note' AND c.status = 'sent')`;
const BALANCE = `(d.total_minor - ${PAID} - ${CREDITED})`;

/**
 * Postgres persistence for every billing document (invoices, receipts, quotes,
 * credit notes; migrations 012, 026, 028), their payments, events and the email log.
 * Content changes only ever apply `WHERE status = 'draft'`: once issued, a
 * document is a frozen snapshot.
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

  static isId(value: unknown): value is string {
    return typeof value === "string" && UUID.test(value);
  }

  /** Newest first; optionally one saved client's, or one type's. */
  async list(filter: { clientId?: string; docType?: DocumentType } = {}): Promise<InvoiceSummary[]> {
    if (filter.clientId !== undefined && !UUID.test(filter.clientId)) return [];
    const rows = (await this.sql.query(
      `SELECT ${InvoiceRepository.SUMMARY} FROM invoices d
       WHERE ($1::uuid IS NULL OR d.client_id = $1::uuid) AND ($2::text IS NULL OR d.doc_type = $2)
       ORDER BY d.created_at DESC LIMIT 300`,
      [filter.clientId ?? null, filter.docType ?? null],
    )) as SummaryRow[];
    return rows.map(InvoiceRepository.toSummary);
  }

  /** Issued invoices with a balance, the longest overdue first. */
  async awaitingPayment(limit = 6): Promise<InvoiceSummary[]> {
    const rows = (await this.sql.query(
      `SELECT ${InvoiceRepository.SUMMARY} FROM invoices d
       WHERE d.doc_type = 'invoice' AND d.status = 'sent' AND ${BALANCE} > 0
       ORDER BY d.due_date, d.created_at LIMIT $1`,
      [limit],
    )) as SummaryRow[];
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
      this.sql.query(`
        WITH b AS (
          SELECT (now() AT TIME ZONE 'Asia/Dubai')::date AS today, date_trunc('month', now() AT TIME ZONE 'Asia/Dubai')::date AS this_month
        ), paid AS (
          SELECT i.currency, p.amount_minor, p.paid_on FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
        ), open AS (
          SELECT d.currency, d.due_date, ${BALANCE} AS balance FROM invoices d WHERE d.doc_type = 'invoice' AND d.status = 'sent'
        )
        SELECT c.currency,
          coalesce((SELECT sum(amount_minor) FROM paid, b WHERE paid.currency = c.currency AND paid_on >= b.this_month), 0)::bigint AS paid_this_month,
          coalesce((SELECT sum(amount_minor) FROM paid, b
                    WHERE paid.currency = c.currency AND paid_on >= (b.this_month - interval '1 month')::date AND paid_on < b.this_month), 0)::bigint AS paid_last_month,
          (SELECT count(*) FROM open WHERE open.currency = c.currency AND balance > 0) AS pending_count,
          coalesce((SELECT sum(balance) FROM open WHERE open.currency = c.currency AND balance > 0), 0)::bigint AS pending_minor,
          (SELECT count(*) FROM open, b WHERE open.currency = c.currency AND balance > 0 AND due_date < b.today) AS overdue_count,
          coalesce((SELECT sum(balance) FROM open, b WHERE open.currency = c.currency AND balance > 0 AND due_date < b.today), 0)::bigint AS overdue_minor
        FROM (SELECT DISTINCT currency FROM invoices WHERE status <> 'draft') c
        ORDER BY c.currency
      `),
      this.sql`
        SELECT count(*) FILTER (WHERE status = 'draft') AS drafts,
               count(*) FILTER (WHERE doc_type = 'quote' AND status = 'sent' AND due_date >= (now() AT TIME ZONE 'Asia/Dubai')::date) AS quotes_awaiting
        FROM invoices
      `,
      this.sql`
        SELECT to_char(p.paid_on, 'YYYY-MM') AS month, i.currency, sum(p.amount_minor)::bigint AS total
        FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id
        WHERE p.paid_on >= (date_trunc('month', now() AT TIME ZONE 'Asia/Dubai') - interval '5 months')::date
        GROUP BY 1, 2
      `,
    ]);
    const c = counts as Record<string, string>;
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
      drafts: Number(c.drafts),
      quotesAwaiting: Number(c.quotes_awaiting),
      recurringDue: (await this.recurringDue()).length,
      paidByMonth: (months as Record<string, string>[]).map((row) => ({ month: row.month, currency: row.currency as Currency, totalMinor: Number(row.total) })),
    };
  }

  async byId(id: string): Promise<Invoice | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql.query(`SELECT ${InvoiceRepository.COLUMNS} FROM invoices d WHERE d.id = $1`, [id])) as InvoiceRow[];
    return row ? InvoiceRepository.toInvoice(row) : null;
  }

  /** The client-facing view: issued documents only (drafts stay private). */
  async byToken(token: string): Promise<Invoice | null> {
    if (!TOKEN.test(token)) return null;
    const [row] = (await this.sql.query(`SELECT ${InvoiceRepository.COLUMNS} FROM invoices d WHERE d.token = $1 AND d.status <> 'draft'`, [
      token,
    ])) as InvoiceRow[];
    return row ? InvoiceRepository.toInvoice(row) : null;
  }

  /** Documents linked to this one: its receipts, credit notes, and the invoice made from a quote. */
  async related(id: string): Promise<InvoiceSummary[]> {
    if (!UUID.test(id)) return [];
    const rows = (await this.sql.query(`SELECT ${InvoiceRepository.SUMMARY} FROM invoices d WHERE d.related_id = $1 ORDER BY d.created_at`, [id])) as SummaryRow[];
    return rows.map(InvoiceRepository.toSummary);
  }

  /** Counts a client opening the document link. Drafts have no public page, so they never count. */
  async recordView(token: string): Promise<void> {
    if (!TOKEN.test(token)) return;
    await this.sql`
      UPDATE invoices SET view_count = view_count + 1, first_viewed_at = coalesce(first_viewed_at, now()), last_viewed_at = now()
      WHERE token = ${token} AND status <> 'draft'
    `;
  }

  /** `bank` is the snapshot of input.bankAccountId, looked up by the caller. */
  async createDraft(input: InvoiceInput, bank: BankDetails | null, actor: string, recursFrom: string | null = null): Promise<string> {
    const t = InvoiceRepository.totals(input);
    const [row] = (await this.sql`
      INSERT INTO invoices (token, doc_type, related_id, booking_uid, client_id, client_name, client_email, client_phone, client_address,
                            currency, items, subtotal_minor, discount_minor, tax_rate_bp, tax_minor, total_minor, trn,
                            due_date, notes, payment_instructions, bank_account_id, bank, payment_terms, terms_days, payment_link, layout,
                            sections, recurring, recurs_from)
      VALUES (${randomBytes(32).toString("base64url")}, ${input.docType}, ${input.relatedId}, ${input.bookingUid}, ${input.clientId},
              ${input.clientName}, ${input.clientEmail}, ${input.clientPhone}, ${input.clientAddress}, ${input.currency},
              ${JSON.stringify(input.items)}::jsonb, ${t.subtotalMinor}, ${t.discountMinor}, ${input.taxRateBp},
              ${t.taxMinor}, ${t.totalMinor}, ${input.trn}, ${input.dueDate}, ${input.notes},
              ${input.paymentInstructions}, ${input.bankAccountId}, ${bank && JSON.stringify(bank)}::jsonb, ${input.paymentTerms},
              ${input.termsDays}, ${input.paymentLink}, ${input.layout}, ${JSON.stringify(input.sections)}::jsonb, ${input.recurring}, ${recursFrom})
      RETURNING id
    `) as { id: string }[];
    await this.logEvent(row.id, actor, "created");
    return row.id;
  }

  /** False when the document is gone or no longer a draft. The type and its links never change. */
  async updateDraft(id: string, input: InvoiceInput, bank: BankDetails | null, actor: string): Promise<boolean> {
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
        bank = ${bank && JSON.stringify(bank)}::jsonb, payment_terms = ${input.paymentTerms}, terms_days = ${input.termsDays}, payment_link = ${input.paymentLink},
        layout = ${input.layout}, sections = ${JSON.stringify(input.sections)}::jsonb, recurring = ${input.recurring}, updated_at = now()
      WHERE id = ${id} AND status = 'draft'
      RETURNING id
    `;
    if (rows.length > 0) await this.logEvent(id, actor, "edited");
    return rows.length > 0;
  }

  /**
   * Draft -> issued: draws the next number from the type's own sequence and
   * freezes it as text with the prefix, e.g. FIP-INV-2026-0002. The row is
   * locked (FOR UPDATE) before nextval runs, so a concurrent issue of the same
   * draft waits, finds it no longer a draft and matches nothing: a lost race
   * never burns a number. With `dueDays`, the due date is counted from the
   * issue date in the same statement, so terms and due date always agree.
   */
  async issue(id: string, prefix: string, actor: string, dueDays: number | null = null): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      WITH target AS (SELECT id, doc_type FROM invoices WHERE id = ${id} AND status = 'draft' FOR UPDATE),
      seq AS (SELECT id, nextval((doc_type || '_number_seq')::regclass)::int AS n FROM target)
      UPDATE invoices i SET
        status = 'sent', number_seq = seq.n,
        number = ${prefix} || '-' || to_char((now() AT TIME ZONE 'Asia/Dubai')::date, 'YYYY') || '-' || lpad(seq.n::text, 4, '0'),
        issue_date = (now() AT TIME ZONE 'Asia/Dubai')::date, sent_at = now(), updated_at = now(),
        due_date = CASE WHEN ${dueDays}::int IS NULL THEN i.due_date ELSE (now() AT TIME ZONE 'Asia/Dubai')::date + ${dueDays}::int END
      FROM seq WHERE i.id = seq.id
      RETURNING i.id
    `;
    if (rows.length > 0) await this.logEvent(id, actor, "issued");
    return rows.length > 0;
  }

  /**
   * Records money received against an issued invoice (or a Quick Receipt).
   * Refuses more than the balance; the payment that clears it marks the
   * document paid. Returns null when refused, or when the payment's
   * submission key was already used (a form sent twice records one payment).
   * ponytail: the balance is read once per statement, so two admins paying the same invoice at the same instant could overpay; fine for one admin.
   */
  async addPayment(id: string, payment: PaymentRecord, actor: string): Promise<{ paymentId: string; settled: boolean } | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql.query(
      `WITH inv AS (
         SELECT d.id, ${BALANCE} AS balance FROM invoices d WHERE d.id = $1 AND d.status = 'sent' AND d.doc_type IN ('invoice', 'receipt') FOR UPDATE
       ), ins AS (
         INSERT INTO invoice_payments (invoice_id, amount_minor, paid_on, note, method, reference, proof_url, submission_key)
         SELECT id, $2::int, $3::date, $4::text, $5::text, $6::text, $7::text, $8::uuid FROM inv WHERE $2::int <= balance
         ON CONFLICT (submission_key) DO NOTHING
         RETURNING id, invoice_id
       ), settle AS (
         UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now()
         WHERE id IN (SELECT invoice_id FROM ins) AND (SELECT balance FROM inv) = $2::int
         RETURNING id
       )
       SELECT (SELECT id FROM ins) AS payment_id, (SELECT count(*) FROM settle)::int AS settled`,
      [id, payment.amountMinor, payment.paidOn, payment.note, payment.method, payment.reference, payment.proofUrl, payment.submissionKey],
    )) as { payment_id: string | null; settled: number }[];
    if (!row.payment_id) return null;
    await this.logEvent(id, actor, "payment", `${InvoiceMath.money(payment.amountMinor, await this.currency(id))} by ${payment.method}${row.settled ? ", paid in full" : ""}`);
    return { paymentId: row.payment_id, settled: row.settled > 0 };
  }

  /** "Mark as paid": records whatever is still due as received today (Dubai) by bank transfer. Returns the payment, if any was needed. */
  async markPaid(id: string, actor: string): Promise<{ paymentId: string | null } | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql.query(
      `WITH inv AS (
         SELECT d.id, d.total_minor, ${BALANCE} AS balance FROM invoices d WHERE d.id = $1 AND d.status = 'sent' AND d.doc_type = 'invoice' FOR UPDATE
       ), ins AS (
         INSERT INTO invoice_payments (invoice_id, amount_minor, paid_on, note)
         SELECT id, balance, (now() AT TIME ZONE 'Asia/Dubai')::date, CASE WHEN balance = total_minor THEN 'Paid in full' ELSE 'Balance' END
         FROM inv WHERE balance > 0
         RETURNING id
       ), upd AS (
         UPDATE invoices SET status = 'paid', paid_at = now(), updated_at = now() WHERE id IN (SELECT id FROM inv) RETURNING id
       )
       SELECT (SELECT count(*) FROM upd)::int AS updated, (SELECT id FROM ins) AS payment_id`,
      [id],
    )) as { updated: number; payment_id: string | null }[];
    if (!row.updated) return null;
    await this.logEvent(id, actor, "paid", "marked paid in full");
    return { paymentId: row.payment_id };
  }

  /** An invoice whose payments and credit notes now cover it is marked paid (after a credit note is issued). */
  async settleIfCovered(id: string, actor: string): Promise<void> {
    if (!UUID.test(id)) return;
    const rows = await this.sql.query(
      `UPDATE invoices d SET status = 'paid', paid_at = now(), updated_at = now()
       WHERE d.id = $1 AND d.status = 'sent' AND d.doc_type = 'invoice' AND ${BALANCE} <= 0 RETURNING d.id`,
      [id],
    );
    if (rows.length > 0) await this.logEvent(id, actor, "paid", "settled by credit note");
  }

  /** Links an issued receipt to the payment it confirms and marks it paid (the money is already received). */
  async completeReceipt(receiptId: string, paymentId: string): Promise<void> {
    await this.sql`
      UPDATE invoices SET payment_id = ${paymentId}, status = 'paid', paid_at = coalesce(paid_at, now()), updated_at = now()
      WHERE id = ${receiptId} AND doc_type = 'receipt' AND status IN ('sent', 'paid')
    `;
  }

  /** A Quick Receipt issued by mistake: its own payment is removed and the receipt voided (its number stays used). */
  async voidQuickReceipt(id: string, actor: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET status = 'void', voided_at = now(), payment_id = NULL, updated_at = now()
      WHERE id = ${id} AND doc_type = 'receipt' AND related_id IS NULL AND status IN ('sent', 'paid')
      RETURNING id
    `;
    if (rows.length === 0) return false;
    await this.sql`DELETE FROM invoice_payments WHERE invoice_id = ${id}`;
    await this.logEvent(id, actor, "voided", "payment removed");
    return true;
  }

  /** Undoes a payment recorded by mistake: its receipt is voided, and a paid invoice goes back to awaiting payment. */
  async removePayment(invoiceId: string, paymentId: string, actor: string): Promise<boolean> {
    if (!UUID.test(invoiceId) || !UUID.test(paymentId)) return false;
    const receipts = (await this.sql`
      UPDATE invoices SET status = 'void', voided_at = now(), updated_at = now()
      WHERE payment_id = ${paymentId} AND doc_type = 'receipt' AND status <> 'void'
      RETURNING id
    `) as { id: string }[];
    const [row] = (await this.sql`
      WITH del AS (
        DELETE FROM invoice_payments p USING invoices i
        WHERE p.id = ${paymentId} AND p.invoice_id = ${invoiceId} AND i.id = p.invoice_id AND i.status IN ('sent', 'paid')
        RETURNING p.invoice_id, p.amount_minor
      ), reopen AS (
        UPDATE invoices SET status = 'sent', paid_at = NULL, updated_at = now()
        WHERE id IN (SELECT invoice_id FROM del) AND status = 'paid'
        RETURNING id
      )
      SELECT (SELECT count(*) FROM del)::int AS removed
    `) as { removed: number }[];
    for (const receipt of receipts) await this.logEvent(receipt.id, actor, "voided", "payment removed");
    if (row.removed > 0) await this.logEvent(invoiceId, actor, "payment removed");
    return row.removed > 0;
  }

  /** Issued documents with no payments can be voided; corrections are a new draft or a credit note. */
  async void(id: string, actor: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET status = 'void', voided_at = now(), updated_at = now()
      WHERE id = ${id} AND status IN ('sent', 'accepted') AND NOT EXISTS (SELECT 1 FROM invoice_payments WHERE invoice_id = ${id})
      RETURNING id
    `;
    if (rows.length > 0) await this.logEvent(id, actor, "voided");
    return rows.length > 0;
  }

  /**
   * A sent quote's answer, given once. An expired quote (past its valid-until
   * date, Dubai) can be declined but not accepted: issue a new one instead.
   */
  async answerQuote(id: string, answer: "accepted" | "declined", actor: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET status = ${answer}, updated_at = now()
      WHERE id = ${id} AND doc_type = 'quote' AND status = 'sent'
        AND (${answer} = 'declined' OR due_date >= (now() AT TIME ZONE 'Asia/Dubai')::date)
      RETURNING id
    `;
    if (rows.length > 0) await this.logEvent(id, actor, answer);
    return rows.length > 0;
  }

  /** The live (not void) invoice made from a quote, if any. A unique index allows at most one. */
  async invoiceFromQuote(quoteId: string): Promise<string | null> {
    if (!UUID.test(quoteId)) return null;
    const [row] = (await this.sql`
      SELECT id FROM invoices WHERE related_id = ${quoteId} AND doc_type = 'invoice' AND status <> 'void'
    `) as { id: string }[];
    return row?.id ?? null;
  }

  /** The document a payment with this submission key was recorded against, if any. */
  async paymentByKey(submissionKey: string): Promise<string | null> {
    if (!UUID.test(submissionKey)) return null;
    const [row] = (await this.sql`SELECT invoice_id FROM invoice_payments WHERE submission_key = ${submissionKey}`) as { invoice_id: string }[];
    return row?.invoice_id ?? null;
  }

  /** Only drafts can be deleted: they hold no number, so nothing is skipped. */
  async deleteDraft(id: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`DELETE FROM invoices WHERE id = ${id} AND status = 'draft' RETURNING id`;
    return rows.length > 0;
  }

  /** Extends the client link by 90 days from now ("Resend link"). */
  async extendLink(id: string, actor: string): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE invoices SET link_valid_until = now() + interval '90 days', updated_at = now()
      WHERE id = ${id} AND status <> 'draft' RETURNING id
    `;
    if (rows.length > 0) await this.logEvent(id, actor, "link renewed", "valid 90 more days");
    return rows.length > 0;
  }

  /**
   * Recurring invoices whose next month hasn't been drafted: the latest of each
   * chain, issued before this (Dubai) month. Drafted copies end their chain, so
   * pressing the button twice never doubles up.
   */
  async recurringDue(): Promise<Invoice[]> {
    const rows = (await this.sql.query(
      `SELECT ${InvoiceRepository.COLUMNS} FROM invoices d
       WHERE d.doc_type = 'invoice' AND d.recurring AND d.status IN ('sent', 'paid')
         AND d.issue_date < date_trunc('month', now() AT TIME ZONE 'Asia/Dubai')::date
         AND NOT EXISTS (SELECT 1 FROM invoices n WHERE n.recurs_from = d.id)
       ORDER BY d.client_name`,
    )) as InvoiceRow[];
    return rows.map(InvoiceRepository.toInvoice);
  }

  /**
   * A saved client's account, oldest first: invoices and Quick Receipts are
   * charges (debit); payments and credit notes reduce what is owed (credit).
   * Payment receipts mirror payments, so they are not listed twice.
   */
  async ledger(clientId: string): Promise<LedgerEntry[]> {
    if (!UUID.test(clientId)) return [];
    const rows = (await this.sql`
      SELECT * FROM (
        SELECT d.issue_date::text AS on_date, d.created_at AS at, d.doc_type AS kind, d.id, d.number, d.currency, d.total_minor AS debit, 0 AS credit
        FROM invoices d
        WHERE d.client_id = ${clientId} AND d.status IN ('sent', 'paid')
          AND (d.doc_type = 'invoice' OR (d.doc_type = 'receipt' AND d.related_id IS NULL))
        UNION ALL
        SELECT d.issue_date::text, d.created_at, 'credit_note', d.id, d.number, d.currency, 0, d.total_minor
        FROM invoices d WHERE d.client_id = ${clientId} AND d.doc_type = 'credit_note' AND d.status = 'sent'
        UNION ALL
        SELECT p.paid_on::text, p.created_at, 'payment', i.id, i.number, i.currency, 0, p.amount_minor
        FROM invoice_payments p JOIN invoices i ON i.id = p.invoice_id WHERE i.client_id = ${clientId}
      ) x
      ORDER BY on_date, at
    `) as { on_date: string; kind: LedgerEntry["kind"]; id: string; number: string | null; currency: Currency; debit: number; credit: number }[];
    return rows.map((row) => ({
      date: row.on_date,
      kind: row.kind,
      documentId: row.id,
      number: row.number,
      currency: row.currency,
      debitMinor: Number(row.debit),
      creditMinor: Number(row.credit),
    }));
  }

  async logEvent(documentId: string, actor: string, event: string, detail = ""): Promise<void> {
    await this.sql`
      INSERT INTO document_events (document_id, actor, event, detail) VALUES (${documentId}, ${actor.slice(0, 120)}, ${event.slice(0, 40)}, ${detail.slice(0, 300)})
    `;
  }

  /** Newest first. */
  async events(documentId: string): Promise<DocumentEvent[]> {
    if (!UUID.test(documentId)) return [];
    const rows = (await this.sql`
      SELECT at, actor, event, detail FROM document_events WHERE document_id = ${documentId} ORDER BY at DESC, id LIMIT 100
    `) as DocumentEvent[];
    return rows;
  }

  async logEmail(entry: Omit<EmailLogEntry, "id" | "sentAt">): Promise<void> {
    await this.sql`
      INSERT INTO email_log (kind, to_email, subject, invoice_id, booking_uid, provider_id)
      VALUES (${entry.kind}, ${entry.toEmail}, ${entry.subject.slice(0, 300)}, ${entry.invoiceId}, ${entry.bookingUid}, ${entry.providerId})
    `;
  }

  /** Newest first; optionally only one document's emails. */
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

  /** Proof upload URL of a payment, for the admin proof viewer. */
  async proofUrl(paymentId: string): Promise<string | null> {
    if (!UUID.test(paymentId)) return null;
    const [row] = (await this.sql`SELECT proof_url FROM invoice_payments WHERE id = ${paymentId}`) as { proof_url: string | null }[];
    return row?.proof_url ?? null;
  }

  private async currency(id: string): Promise<Currency> {
    const [row] = (await this.sql`SELECT currency FROM invoices WHERE id = ${id}`) as { currency: Currency }[];
    return row?.currency ?? "AED";
  }

  // Dates as text so they stay YYYY-MM-DD regardless of the server's timezone. Rows are aliased `d`.
  private static readonly SUMMARY = `d.id, d.doc_type, d.number_seq, d.number, d.status, d.client_name, d.currency, d.total_minor,
    d.issue_date::text AS issue_date, d.due_date::text AS due_date, d.created_at, d.first_viewed_at,
    ${PAID}::int AS paid_minor, ${CREDITED}::int AS credited_minor,
    (SELECT max(sent_at) FROM email_log e WHERE e.invoice_id = d.id) AS last_emailed_at`;

  private static readonly COLUMNS = `d.id, d.doc_type, d.number_seq, d.number, d.related_id, d.payment_id, d.token, d.status, d.booking_uid,
    d.client_id, d.client_name, d.client_email, d.client_phone, d.client_address, d.currency, d.items, d.subtotal_minor, d.discount_minor,
    d.tax_rate_bp, d.tax_minor, d.total_minor, d.trn, d.due_date::text AS due_date, d.notes, d.payment_instructions, d.bank_account_id,
    d.bank, d.payment_terms, d.terms_days, d.payment_link, d.layout, d.sections, d.recurring, d.recurs_from, d.link_valid_until,
    d.issue_date::text AS issue_date, d.created_at, d.sent_at, d.paid_at, d.voided_at, d.view_count, d.first_viewed_at, d.last_viewed_at,
    (SELECT r.number FROM invoices r WHERE r.id = d.related_id) AS related_number,
    ${PAID}::int AS paid_minor, ${CREDITED}::int AS credited_minor,
    (SELECT coalesce(json_agg(json_build_object('id', p.id, 'amountMinor', p.amount_minor, 'paidOn', p.paid_on::text, 'note', p.note,
       'method', p.method, 'reference', p.reference, 'proofUrl', p.proof_url,
       'receiptId', (SELECT r.id FROM invoices r WHERE r.payment_id = p.id AND r.status <> 'void' LIMIT 1))
       ORDER BY p.paid_on, p.created_at), '[]') FROM invoice_payments p WHERE p.invoice_id = d.id) AS payments,
    (SELECT json_build_object('id', p.id, 'amountMinor', p.amount_minor, 'paidOn', p.paid_on::text, 'note', p.note, 'method', p.method,
       'reference', p.reference, 'proofUrl', p.proof_url, 'receiptId', d.id) FROM invoice_payments p WHERE p.id = d.payment_id) AS receipt_payment`;

  private static totals(input: InvoiceInput) {
    return InvoiceMath.totals(
      input.items.map((item) => item.amountMinor),
      input.discountMinor,
      input.taxRateBp,
    );
  }

  /** The frozen number; older rows from before 028 fall back to the format they were issued with. */
  private static number(row: Pick<InvoiceRow, "number" | "number_seq" | "issue_date">): string | null {
    if (row.number) return row.number;
    return row.number_seq !== null && row.issue_date ? InvoiceMath.number(row.issue_date, row.number_seq) : null;
  }

  private static toSummary(row: SummaryRow): InvoiceSummary {
    return {
      id: row.id,
      docType: row.doc_type,
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
      creditedMinor: row.credited_minor,
    };
  }

  private static toInvoice(row: InvoiceRow): Invoice {
    return {
      id: row.id,
      docType: row.doc_type,
      relatedId: row.related_id,
      relatedNumber: row.related_number,
      paymentId: row.payment_id,
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
      paymentTerms: row.payment_terms,
      termsDays: row.terms_days,
      paymentLink: row.payment_link,
      layout: row.layout,
      sections: { scope: "", deliverables: "", expenses: "", assumptions: "", ...row.sections },
      recurring: row.recurring,
      recursFrom: row.recurs_from,
      linkValidUntil: row.link_valid_until,
      issueDate: row.issue_date,
      createdAt: row.created_at,
      sentAt: row.sent_at,
      paidAt: row.paid_at,
      voidedAt: row.voided_at,
      paidMinor: row.paid_minor,
      creditedMinor: row.credited_minor,
      payments: row.payments,
      receiptPayment: row.receipt_payment,
      viewCount: row.view_count,
      firstViewedAt: row.first_viewed_at,
      lastViewedAt: row.last_viewed_at,
    };
  }
}
