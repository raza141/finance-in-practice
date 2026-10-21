import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { Agreement, AgreementInput, Currency, ItemUnit } from "../types";

interface AgreementRow {
  id: string;
  client_id: string;
  service_id: string;
  service_code: string;
  service_name: string;
  unit: ItemUnit;
  currency: Currency;
  rate_minor: number;
  starts_on: string;
  ends_on: string | null;
  payment_terms: Agreement["paymentTerms"];
  terms_days: number | null;
  schedule: string;
  scope: string;
  archived_at: Date | null;
  hours_per_month: string | null;
  accepted_at: Date | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dates as text so they stay YYYY-MM-DD regardless of the server's timezone.
const SELECT = `
  SELECT a.id, a.client_id, a.service_id, s.code AS service_code, s.name AS service_name, a.unit, a.currency, a.rate_minor,
    a.starts_on::text AS starts_on, a.ends_on::text AS ends_on, a.payment_terms, a.terms_days, a.schedule, a.scope, a.archived_at,
    a.hours_per_month, a.accepted_at
  FROM client_agreements a JOIN services s ON s.id = a.service_id`;

/**
 * Client agreements (migration 032): an agreed rate for one service, basis and
 * currency over dates. Lines copy the rate when an agreement is applied, so
 * editing or ending an agreement never changes an issued document.
 */
export class AgreementRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): AgreementRepository | null {
    const sql = Database.sql();
    return sql ? new AgreementRepository(sql) : null;
  }

  /** A client's agreements, newest first; ended (archived) ones only when asked. */
  async forClient(clientId: string, options: { archived?: boolean } = {}): Promise<Agreement[]> {
    if (!UUID.test(clientId)) return [];
    const rows = (await this.sql.query(`${SELECT} WHERE a.client_id = $1 AND ($2 OR a.archived_at IS NULL) ORDER BY a.starts_on DESC, a.created_at DESC`, [
      clientId,
      options.archived ?? false,
    ])) as AgreementRow[];
    return rows.map(AgreementRepository.toAgreement);
  }

  /** Every live agreement, for the document form (filtered per client there). */
  async active(): Promise<Agreement[]> {
    const rows = (await this.sql.query(`${SELECT} WHERE a.archived_at IS NULL ORDER BY a.starts_on DESC LIMIT 2000`)) as AgreementRow[];
    return rows.map(AgreementRepository.toAgreement);
  }

  async byIds(ids: readonly string[]): Promise<Agreement[]> {
    const valid = ids.filter((id) => UUID.test(id));
    if (valid.length === 0) return [];
    const rows = (await this.sql.query(`${SELECT} WHERE a.id = ANY ($1::uuid[])`, [valid])) as AgreementRow[];
    return rows.map(AgreementRepository.toAgreement);
  }

  /** Null when the service no longer offers that basis (or is gone). */
  async create(clientId: string, input: AgreementInput): Promise<string | null> {
    if (!UUID.test(clientId)) return null;
    const [row] = (await this.sql`
      INSERT INTO client_agreements (client_id, service_id, unit, currency, rate_minor, starts_on, ends_on, payment_terms, terms_days, schedule, scope, hours_per_month)
      SELECT ${clientId}, ${input.serviceId}, ${input.unit}, ${input.currency}, ${input.rateMinor}, ${input.startsOn}, ${input.endsOn},
             ${input.paymentTerms}, ${input.termsDays}, ${input.schedule}, ${input.scope}, ${input.hoursPerMonth}
      WHERE EXISTS (SELECT 1 FROM services WHERE id = ${input.serviceId} AND ${input.unit} = ANY (units))
      RETURNING id
    `) as { id: string }[];
    return row?.id ?? null;
  }

  /**
   * The agreement an accepted quote creates, already accepted (with the terms
   * version). Once per quote: accepting again changes nothing. Null when the
   * service doesn't offer that basis.
   */
  async createFromQuote(clientId: string, input: AgreementInput, quoteId: string, termsVersion: string | null): Promise<string | null> {
    if (!UUID.test(clientId) || !UUID.test(quoteId)) return null;
    const [row] = (await this.sql`
      INSERT INTO client_agreements (client_id, service_id, unit, currency, rate_minor, starts_on, ends_on, payment_terms, terms_days, schedule, scope,
                                     hours_per_month, quote_id, accepted_at, accepted_terms)
      SELECT ${clientId}, ${input.serviceId}, ${input.unit}, ${input.currency}, ${input.rateMinor}, ${input.startsOn}, ${input.endsOn},
             ${input.paymentTerms}, ${input.termsDays}, ${input.schedule}, ${input.scope}, ${input.hoursPerMonth}, ${quoteId}, now(), ${termsVersion}
      WHERE EXISTS (SELECT 1 FROM services WHERE id = ${input.serviceId} AND ${input.unit} = ANY (units))
      ON CONFLICT (quote_id) WHERE quote_id IS NOT NULL DO NOTHING
      RETURNING id
    `) as { id: string }[];
    return row?.id ?? null;
  }

  /** A revised quote was accepted: the agreement the earlier version created ends. */
  async archiveFromQuote(clientId: string, quoteId: string): Promise<void> {
    if (!UUID.test(clientId) || !UUID.test(quoteId)) return;
    await this.sql`UPDATE client_agreements SET archived_at = now() WHERE client_id = ${clientId} AND quote_id = ${quoteId} AND archived_at IS NULL`;
  }

  /** Live agreements the student hasn't accepted in their portal yet, with the client's name, for the dashboard. */
  async unaccepted(): Promise<{ clientId: string; clientName: string }[]> {
    const rows = (await this.sql`
      SELECT a.client_id, c.name FROM client_agreements a JOIN clients c ON c.id = a.client_id
      WHERE a.archived_at IS NULL AND a.accepted_at IS NULL ORDER BY a.created_at DESC LIMIT 50
    `) as { client_id: string; name: string }[];
    return rows.map((r) => ({ clientId: r.client_id, clientName: r.name }));
  }

  /** Ends an agreement: it is no longer offered on new documents. */
  async archive(clientId: string, id: string): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE client_agreements SET archived_at = now() WHERE id = ${id} AND client_id = ${clientId} AND archived_at IS NULL RETURNING id
    `;
    return rows.length > 0;
  }

  /**
   * The student accepts their own agreement in the portal, with the terms
   * version they were shown (null before any version is published in admin).
   * Only once, and only a live one of theirs.
   */
  async accept(clientId: string, id: string, termsVersion: string | null): Promise<boolean> {
    if (!UUID.test(clientId) || !UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE client_agreements SET accepted_at = now(), accepted_terms = ${termsVersion}
      WHERE id = ${id} AND client_id = ${clientId} AND archived_at IS NULL AND accepted_at IS NULL RETURNING id
    `;
    return rows.length > 0;
  }

  private static toAgreement(row: AgreementRow): Agreement {
    return {
      id: row.id,
      clientId: row.client_id,
      serviceId: row.service_id,
      serviceCode: row.service_code,
      serviceName: row.service_name,
      unit: row.unit,
      currency: row.currency,
      rateMinor: row.rate_minor,
      startsOn: row.starts_on,
      endsOn: row.ends_on,
      paymentTerms: row.payment_terms,
      termsDays: row.terms_days,
      schedule: row.schedule,
      scope: row.scope,
      archivedAt: row.archived_at,
      hoursPerMonth: row.hours_per_month === null ? null : Number(row.hours_per_month),
      acceptedAt: row.accepted_at,
    };
  }
}
