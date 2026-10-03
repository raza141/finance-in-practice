/**
 * Applies pending schema migrations to the Neon database in DATABASE_URL.
 *
 *   npm run db:migrate            # reads .env.local
 *
 * Each migration runs in one transaction and is recorded in
 * schema_migrations, so re-running is a no-op. Append new migrations to the
 * end of MIGRATIONS; never edit one that has already been applied.
 */
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

interface Migration {
  id: string;
  statements: string[];
}

const MIGRATIONS: Migration[] = [
  {
    id: "001_testimonials",
    statements: [
      `CREATE TABLE testimonials (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        author       text NOT NULL CHECK (char_length(author) BETWEEN 2 AND 80),
        email        text NOT NULL CHECK (char_length(email) <= 254),
        context      text NOT NULL CHECK (char_length(context) BETWEEN 2 AND 100),
        program      text NOT NULL CHECK (char_length(program) <= 60),
        quote        text NOT NULL CHECK (char_length(quote) BETWEEN 40 AND 600),
        outcome      text CHECK (char_length(outcome) <= 100),
        status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        consent_at   timestamptz NOT NULL,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        reviewed_at  timestamptz
      )`,
      `CREATE INDEX testimonials_status_submitted_idx ON testimonials (status, submitted_at DESC)`,
    ],
  },
  {
    id: "002_admin_auth",
    statements: [
      // Allowlist: only rows here can sign in, by password or by Google.
      `CREATE TABLE admin_users (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email         text NOT NULL UNIQUE CHECK (email = lower(email) AND char_length(email) <= 254),
        name          text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
        password_hash text,
        google_sub    text UNIQUE,
        active        boolean NOT NULL DEFAULT true,
        created_at    timestamptz NOT NULL DEFAULT now(),
        last_login_at timestamptz
      )`,
      // Only the SHA-256 of each session token is stored, never the token.
      `CREATE TABLE admin_sessions (
        token_hash text PRIMARY KEY,
        user_id    uuid NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz NOT NULL
      )`,
      `CREATE INDEX admin_sessions_user_idx ON admin_sessions (user_id)`,
    ],
  },
];

// Explicit fields, not constructor parameter properties: Node runs this file
// with type stripping only, which doesn't support them.
class SchemaMigrator {
  private readonly sql: NeonQueryFunction<false, false>;
  private readonly migrations: Migration[];

  constructor(sql: NeonQueryFunction<false, false>, migrations: Migration[]) {
    this.sql = sql;
    this.migrations = migrations;
  }

  async run(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id         text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const rows = (await this.sql`SELECT id FROM schema_migrations`) as { id: string }[];
    const applied = new Set(rows.map((row) => row.id));

    const pending = this.migrations.filter((m) => !applied.has(m.id));
    if (pending.length === 0) {
      console.log("Schema is up to date.");
      return;
    }
    for (const migration of pending) {
      await this.sql.transaction([
        ...migration.statements.map((statement) => this.sql.query(statement)),
        this.sql`INSERT INTO schema_migrations (id) VALUES (${migration.id})`,
      ]);
      console.log(`Applied ${migration.id}`);
    }
  }
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to frontend/.env.local (see .env.example).");
  process.exit(1);
}

await new SchemaMigrator(neon(url), MIGRATIONS).run();
