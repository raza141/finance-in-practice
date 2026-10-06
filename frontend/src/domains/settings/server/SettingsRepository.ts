import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import { SettingsContract } from "../services/SettingsContract";
import type { BillingSettings } from "../types";

const isMissingTable = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "42P01";

/** The single settings row (migration 027_settings), always read over the defaults. */
export class SettingsRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): SettingsRepository | null {
    const sql = Database.sql();
    return sql ? new SettingsRepository(sql) : null;
  }

  /** Defaults when nothing is saved yet, or before the migration has run. */
  static async load(): Promise<BillingSettings> {
    return (await SettingsRepository.fromEnv()?.get()) ?? SettingsContract.DEFAULTS;
  }

  async get(): Promise<BillingSettings> {
    try {
      const [row] = (await this.sql`SELECT data FROM settings WHERE id`) as { data: unknown }[];
      return SettingsContract.merge(row?.data);
    } catch (error) {
      if (isMissingTable(error)) return SettingsContract.DEFAULTS;
      throw error;
    }
  }

  async save(settings: BillingSettings, adminId: string): Promise<void> {
    await this.sql`
      INSERT INTO settings (id, data, updated_by) VALUES (true, ${JSON.stringify(settings)}::jsonb, ${adminId})
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_by = EXCLUDED.updated_by, updated_at = now()
    `;
  }
}
