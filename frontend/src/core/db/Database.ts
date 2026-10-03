import "server-only";

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

export type Sql = NeonQueryFunction<false, false>;

/**
 * Process-wide handle to the Neon Postgres database (HTTP driver: one
 * request per query, no pooled connections to leak on serverless).
 *
 * Returns null when no connection string is configured, so builds and
 * previews without a database degrade instead of crashing.
 */
export class Database {
  private static client: Sql | null | undefined;

  /** Neon's Vercel integration sets DATABASE_URL; POSTGRES_URL is its legacy alias. */
  static url(): string | null {
    return process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
  }

  static sql(): Sql | null {
    if (Database.client === undefined) {
      const url = Database.url();
      Database.client = url ? neon(url) : null;
    }
    return Database.client;
  }
}
