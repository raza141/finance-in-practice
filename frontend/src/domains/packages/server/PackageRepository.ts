import "server-only";

import { Database, type Sql } from "@/core/db/Database";
import type { Currency } from "@/domains/invoices/types";

import type { Package, PackageAudience, PackageBilling, PackageFeature, PackageInput } from "../types";

interface PackageRow {
  id: string;
  name: string;
  tagline: string;
  hours: number | null;
  price_minor: number | null;
  currency: Currency;
  billing: PackageBilling;
  audience: PackageAudience;
  features: PackageFeature[];
  position: number;
  featured: boolean;
  is_active: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUMNS = "id, name, tagline, hours, price_minor, currency, billing, audience, features, position, featured, is_active";

/**
 * Packages (053–054) and the one each student is on. A priced package is also a
 * client agreement on the PKG service, in its billing unit (package: hours in
 * total in hours_per_month; month: hours each month; hour: no limit), so the
 * allowance, the booking limit and the invoice form all work from it unchanged.
 */
export class PackageRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): PackageRepository | null {
    const sql = Database.sql();
    return sql ? new PackageRepository(sql) : null;
  }

  /** What /pricing and registration offer, in page order. */
  async active(): Promise<Package[]> {
    const rows = (await this.sql.query(`SELECT ${COLUMNS} FROM packages WHERE is_active ORDER BY position, name`)) as PackageRow[];
    return rows.map(PackageRepository.toPackage);
  }

  async all(): Promise<Package[]> {
    const rows = (await this.sql.query(`SELECT ${COLUMNS} FROM packages ORDER BY is_active DESC, position, name`)) as PackageRow[];
    return rows.map(PackageRepository.toPackage);
  }

  async byId(id: string): Promise<Package | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql.query(`SELECT ${COLUMNS} FROM packages WHERE id = $1`, [id])) as PackageRow[];
    return row ? PackageRepository.toPackage(row) : null;
  }

  /** Creates (no id) or updates a package. Students already on it keep their agreement's price and hours. Null: not found. */
  async save(id: string | null, p: PackageInput): Promise<string | null> {
    const features = JSON.stringify(p.features);
    if (id === null) {
      const [row] = (await this.sql`
        INSERT INTO packages (name, tagline, hours, price_minor, currency, billing, audience, features, position, featured, is_active)
        VALUES (${p.name}, ${p.tagline}, ${p.hours}, ${p.priceMinor}, ${p.currency}, ${p.billing}, ${p.audience}, ${features}::jsonb, ${p.position}, ${p.featured}, ${p.isActive})
        RETURNING id
      `) as { id: string }[];
      return row.id;
    }
    if (!UUID.test(id)) return null;
    const rows = await this.sql`
      UPDATE packages SET name = ${p.name}, tagline = ${p.tagline}, hours = ${p.hours}, price_minor = ${p.priceMinor}, currency = ${p.currency}, billing = ${p.billing}, audience = ${p.audience},
        features = ${features}::jsonb, position = ${p.position}, featured = ${p.featured}, is_active = ${p.isActive}, updated_at = now()
      WHERE id = ${id} RETURNING id
    `;
    return rows.length > 0 ? id : null;
  }

  /** The student's package and the one they asked to move to (null: none open). */
  async ofClient(clientId: string): Promise<{ current: Package | null; requested: Package | null; requestedAt: string | null }> {
    const empty = { current: null, requested: null, requestedAt: null };
    if (!UUID.test(clientId)) return empty;
    const [row] = (await this.sql`SELECT package_id, requested_package_id, package_requested_at::text AS requested_at FROM clients WHERE id = ${clientId}`) as {
      package_id: string | null;
      requested_package_id: string | null;
      requested_at: string | null;
    }[];
    if (!row) return empty;
    const [current, requested] = await Promise.all([
      row.package_id ? this.byId(row.package_id) : null,
      row.requested_package_id ? this.byId(row.requested_package_id) : null,
    ]);
    return { current, requested, requestedAt: requested ? row.requested_at : null };
  }

  /**
   * Puts the client on a package from `startsOn` (may be past: sessions since then count): their live package agreement ends,
   * and a priced package starts a new one (billed as the package bills), sent to
   * their portal to accept. Custom starts none: the owner agrees it and sends the
   * agreement. An open request closes. `firstOnly` (registration): only when they
   * have no package yet, so a second course never replaces it. `priceMinor`: an agreed
   * price for this client in place of the package's. Null when nothing changed.
   */
  async assign(clientId: string, packageId: string, startsOn: string, { firstOnly = false, priceMinor = null }: { firstOnly?: boolean; priceMinor?: number | null } = {}): Promise<Package | null> {
    if (!UUID.test(clientId) || !UUID.test(packageId)) return null;
    const changed = await this.sql`
      UPDATE clients SET package_id = ${packageId}, requested_package_id = NULL, package_requested_at = NULL, updated_at = now()
      WHERE id = ${clientId} AND (${!firstOnly} OR package_id IS NULL) AND EXISTS (SELECT 1 FROM packages WHERE id = ${packageId})
      RETURNING id
    `;
    if (changed.length === 0) return null;
    await this.sql.transaction([
      this.sql`
        UPDATE client_agreements SET archived_at = now()
        WHERE client_id = ${clientId} AND archived_at IS NULL AND service_id = (SELECT id FROM services WHERE code = 'PKG')
      `,
      this.sql`
        INSERT INTO client_agreements (client_id, service_id, unit, currency, rate_minor, starts_on, scope, hours_per_month)
        SELECT ${clientId}, s.id, p.billing, p.currency, COALESCE(${priceMinor}::integer, p.price_minor), ${startsOn},
               p.name || CASE p.billing WHEN 'hour' THEN ': by the hour' WHEN 'month' THEN ': ' || p.hours || ' live hours a month' ELSE ': ' || p.hours || ' live hours' END,
               p.hours
        FROM packages p, services s
        WHERE p.id = ${packageId} AND p.price_minor IS NOT NULL AND s.code = 'PKG'
      `,
    ]);
    return this.byId(packageId);
  }

  /** The student asks to move to another package (null withdraws). False when nothing changed. */
  async request(clientId: string, packageId: string | null): Promise<boolean> {
    if (!UUID.test(clientId) || (packageId !== null && !UUID.test(packageId))) return false;
    const rows = await this.sql`
      UPDATE clients SET requested_package_id = ${packageId}, package_requested_at = CASE WHEN ${packageId}::uuid IS NULL THEN NULL ELSE now() END
      WHERE id = ${clientId} AND requested_package_id IS DISTINCT FROM ${packageId}::uuid
        AND (${packageId}::uuid IS NULL OR (package_id IS DISTINCT FROM ${packageId}::uuid AND EXISTS (SELECT 1 FROM packages WHERE id = ${packageId} AND is_active)))
      RETURNING id
    `;
    return rows.length > 0;
  }

  private static toPackage(row: PackageRow): Package {
    return {
      id: row.id,
      name: row.name,
      tagline: row.tagline,
      hours: row.hours,
      priceMinor: row.price_minor,
      currency: row.currency,
      billing: row.billing,
      audience: row.audience,
      features: row.features,
      position: row.position,
      featured: row.featured,
      isActive: row.is_active,
    };
  }
}
