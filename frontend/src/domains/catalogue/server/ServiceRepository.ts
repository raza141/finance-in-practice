import "server-only";

import { Database, type Sql } from "@/core/db/Database";
import type { ItemUnit } from "@/domains/invoices/types";

import type { PriceInput, Service, ServiceInput, ServicePrice } from "../types";

interface ServiceRow {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  units: ItemUnit[];
  default_unit: ItemUnit | null;
  archived_at: Date | null;
  prices: ServicePrice[];
}

/** Why a write was refused, for the form; null on success. */
export type CatalogueError = "duplicate-code" | "overlap" | "unit" | "missing";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Dates as text so they stay YYYY-MM-DD regardless of the server's timezone.
const SELECT = `
  SELECT s.id, s.code, s.name, s.description, s.category, s.units, s.default_unit, s.archived_at,
    (SELECT coalesce(json_agg(json_build_object('id', p.id, 'unit', p.unit, 'currency', p.currency, 'rateMinor', p.rate_minor,
       'effectiveFrom', p.effective_from::text, 'effectiveTo', p.effective_to::text) ORDER BY p.unit, p.currency, p.effective_from), '[]')
     FROM service_prices p WHERE p.service_id = s.id) AS prices
  FROM services s`;

/**
 * The service catalogue (migration 031): services and their dated prices.
 * Documents copy a service's code, name and price onto each line, so nothing
 * here ever changes an issued document.
 */
export class ServiceRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): ServiceRepository | null {
    const sql = Database.sql();
    return sql ? new ServiceRepository(sql) : null;
  }

  /** By code; archived ones only when asked. */
  async all(options: { archived?: boolean } = {}): Promise<Service[]> {
    const rows = (await this.sql.query(`${SELECT} WHERE (s.archived_at IS NOT NULL) = $1 ORDER BY s.code LIMIT 1000`, [
      options.archived ?? false,
    ])) as ServiceRow[];
    return rows.map(ServiceRepository.toService);
  }

  async byId(id: string): Promise<Service | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql.query(`${SELECT} WHERE s.id = $1`, [id])) as ServiceRow[];
    return row ? ServiceRepository.toService(row) : null;
  }

  /** Services by id, archived or not (documents may still use an archived one). */
  async byIds(ids: readonly string[]): Promise<Service[]> {
    const valid = [...new Set(ids.filter((id) => UUID.test(id)))];
    if (valid.length === 0) return [];
    const rows = (await this.sql.query(`${SELECT} WHERE s.id = ANY ($1::uuid[])`, [valid])) as ServiceRow[];
    return rows.map(ServiceRepository.toService);
  }

  /** The new id, or why it was refused. */
  async create(input: ServiceInput): Promise<{ id: string } | CatalogueError> {
    try {
      const [row] = (await this.sql`
        INSERT INTO services (code, name, description, category, units, default_unit)
        VALUES (${input.code}, ${input.name}, ${input.description}, ${input.category}, ${input.units}, ${input.defaultUnit})
        RETURNING id
      `) as { id: string }[];
      return { id: row.id };
    } catch (error) {
      if (Database.isUniqueViolation(error)) return "duplicate-code";
      throw error;
    }
  }

  async update(id: string, input: ServiceInput): Promise<CatalogueError | null> {
    if (!UUID.test(id)) return "missing";
    try {
      const rows = await this.sql`
        UPDATE services SET code = ${input.code}, name = ${input.name}, description = ${input.description}, category = ${input.category},
          units = ${input.units}, default_unit = ${input.defaultUnit}, updated_at = now()
        WHERE id = ${id} RETURNING id
      `;
      return rows.length > 0 ? null : "missing";
    } catch (error) {
      if (Database.isUniqueViolation(error)) return "duplicate-code";
      throw error;
    }
  }

  /** Archive (hidden from new selections) or reactivate. */
  async setArchived(id: string, archived: boolean): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = await this.sql`
      UPDATE services SET archived_at = ${archived ? new Date() : null}, updated_at = now()
      WHERE id = ${id} AND (archived_at IS NOT NULL) <> ${archived} RETURNING id
    `;
    return rows.length > 0;
  }

  /**
   * Adds a price. A price already open for the same basis and currency ends the
   * day before the new one starts, in the same statement; anything still
   * overlapping (a price starting the same day or later) is refused by the
   * deferred exclusion constraint. The basis must be one the service offers.
   */
  async addPrice(serviceId: string, price: PriceInput): Promise<CatalogueError | null> {
    if (!UUID.test(serviceId)) return "missing";
    try {
      const rows = await this.sql`
        WITH closed AS (
          UPDATE service_prices SET effective_to = ${price.effectiveFrom}::date - 1
          WHERE service_id = ${serviceId} AND unit = ${price.unit} AND currency = ${price.currency}
            AND effective_from < ${price.effectiveFrom}::date AND (effective_to IS NULL OR effective_to >= ${price.effectiveFrom}::date)
          RETURNING id
        )
        INSERT INTO service_prices (service_id, unit, currency, rate_minor, effective_from, effective_to)
        SELECT ${serviceId}, ${price.unit}, ${price.currency}, ${price.rateMinor}, ${price.effectiveFrom}, ${price.effectiveTo}
        WHERE EXISTS (SELECT 1 FROM services WHERE id = ${serviceId} AND ${price.unit} = ANY (units))
        RETURNING id
      `;
      return rows.length > 0 ? null : "unit";
    } catch (error) {
      if ((error as { code?: unknown })?.code === "23P01") return "overlap";
      throw error;
    }
  }

  /**
   * Removes a price entered by mistake. The price it had ended (the one ending
   * the day before it started) takes its place again, in the same statement.
   * Documents keep the rate they were issued with.
   */
  async removePrice(serviceId: string, priceId: string): Promise<{ removed: boolean; restored: boolean }> {
    if (!UUID.test(serviceId) || !UUID.test(priceId)) return { removed: false, restored: false };
    const [row] = (await this.sql`
      WITH del AS (
        DELETE FROM service_prices WHERE id = ${priceId} AND service_id = ${serviceId}
        RETURNING service_id, unit, currency, effective_from, effective_to
      ), restored AS (
        UPDATE service_prices p SET effective_to = del.effective_to FROM del
        WHERE p.service_id = del.service_id AND p.unit = del.unit AND p.currency = del.currency AND p.effective_to = del.effective_from - 1
        RETURNING p.id
      )
      SELECT (SELECT count(*) FROM del)::int AS removed, (SELECT count(*) FROM restored)::int AS restored
    `) as { removed: number; restored: number }[];
    return { removed: row.removed > 0, restored: row.restored > 0 };
  }

  private static toService(row: ServiceRow): Service {
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description,
      category: row.category,
      units: row.units,
      defaultUnit: row.default_unit,
      archivedAt: row.archived_at,
      prices: row.prices,
    };
  }
}
