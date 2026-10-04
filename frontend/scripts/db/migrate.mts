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
  {
    id: "003_courses",
    statements: [
      // Public course catalogue. Rows start inactive; only active ones are
      // served on /courses/[slug]. Fee is in minor units (fils, cents) so no
      // float rounding; null start date / price means "on request".
      `CREATE TABLE courses (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug         text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 80),
        title        text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
        summary      text NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 600),
        -- Keep in sync with CourseFormat.CATEGORIES; adding one needs a new migration.
        category     text NOT NULL CHECK (category IN (
                       'Portfolio Construction', 'Fixed Income', 'Quantitative Finance', 'Risk Management',
                       'Wealth Management', 'Financial Modeling', 'Exam Prep')),
        start_date   date,
        duration     text NOT NULL CHECK (char_length(duration) BETWEEN 2 AND 40),
        price_minor  integer CHECK (price_minor >= 0),
        currency     text NOT NULL DEFAULT 'AED' CHECK (currency ~ '^[A-Z]{3}$'),
        is_active    boolean NOT NULL DEFAULT false,
        -- [{ "title": text, "summary"?: text, "topics": [text] }, ...]
        syllabus     jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(syllabus) = 'array'),
        -- A PDF committed to public/brochures/, e.g. /brochures/portfolio-ml.pdf.
        brochure_url text CHECK (brochure_url ~ '^/brochures/[A-Za-z0-9._-]+\\.pdf$'),
        created_at   timestamptz NOT NULL DEFAULT now(),
        updated_at   timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX courses_active_start_idx ON courses (is_active, start_date)`,
    ],
  },
  {
    id: "004_order_testimonials",
    statements: [
      // Testimonials become a trade ledger ("order book"). The review text
      // stays in quote and the name in author. The new fields are nullable
      // so rows submitted before this migration remain valid, but a row has
      // either all five or none (see testimonials_ledger_complete).
      // Scores are percentages (e.g. a mock exam score), so yield is the
      // relative improvement; it may be negative.
      `ALTER TABLE testimonials
        ADD COLUMN side          text CHECK (side IN ('BUY', 'HOLD')),
        ADD COLUMN ticker        text CHECK (ticker IN ('CFA', 'FRM', 'PSX', 'QUANT', 'UNI')),
        ADD COLUMN conviction    smallint CHECK (conviction BETWEEN 1 AND 10),
        ADD COLUMN before_score  smallint CHECK (before_score BETWEEN 1 AND 100),
        ADD COLUMN after_score   smallint CHECK (after_score BETWEEN 0 AND 100),
        ADD COLUMN yield_percent numeric(7, 2) GENERATED ALWAYS AS (
          round((after_score - before_score)::numeric * 100 / NULLIF(before_score, 0), 2)
        ) STORED,
        ADD CONSTRAINT testimonials_ledger_complete
          CHECK (num_nulls(side, ticker, conviction, before_score, after_score) IN (0, 5)),
        ALTER COLUMN program DROP NOT NULL`,
      `CREATE INDEX testimonials_ticker_idx ON testimonials (ticker) WHERE status = 'approved'`,
    ],
  },
  {
    id: "005_testimonial_location",
    statements: [
      // Where the learner is. Nullable for rows submitted before this
      // migration; the submission API requires both for new ones.
      `ALTER TABLE testimonials
        ADD COLUMN country text CHECK (char_length(country) BETWEEN 2 AND 60),
        ADD COLUMN city    text CHECK (char_length(city) BETWEEN 2 AND 60)`,
    ],
  },
  {
    id: "006_ticker_levels",
    statements: [
      // CFA and FRM split by exam level. Existing rows map to the first level.
      `ALTER TABLE testimonials DROP CONSTRAINT testimonials_ticker_check`,
      `UPDATE testimonials SET ticker = CASE ticker WHEN 'CFA' THEN 'CFA1' WHEN 'FRM' THEN 'FRM1' ELSE ticker END
        WHERE ticker IN ('CFA', 'FRM')`,
      `ALTER TABLE testimonials ADD CONSTRAINT testimonials_ticker_check
        CHECK (ticker IN ('CFA1', 'CFA2', 'FRM1', 'UNI', 'PSX', 'QUANT'))`,
    ],
  },
  {
    id: "007_instructors",
    statements: [
      // The teaching team on /about, managed from /admin/instructors. Lowest
      // sort_order shows first; the first active one is the home-page teaser.
      `CREATE TABLE instructors (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name       text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
        role       text NOT NULL CHECK (char_length(role) BETWEEN 2 AND 120),
        bio        text NOT NULL CHECK (char_length(bio) BETWEEN 20 AND 1200),
        background text NOT NULL DEFAULT '' CHECK (char_length(background) <= 800),
        -- JSON arrays of strings.
        education  jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(education) = 'array'),
        highlights jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(highlights) = 'array'),
        -- A file in public/team/ or an https:// image URL.
        photo_url  text CHECK (photo_url ~ '^(/team/[A-Za-z0-9._-]+|https://\\S+)$' AND char_length(photo_url) <= 500),
        sort_order integer NOT NULL DEFAULT 0,
        is_active  boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`,
      // Seed with the profile that used to be hard-coded in InstructorCatalog.
      `INSERT INTO instructors (name, role, bio, background, education, highlights, sort_order, is_active) VALUES (
        'Muhammad Ahmed Raza',
        'Founder · Lead Instructor',
        $$Muhammad Ahmed Raza teaches financial theory through exam-style practice and practical implementation. His approach connects CFA and FRM concepts with valuation, risk models, Python workflows and real-world financial analysis.$$,
        $$Builds the in-house quant engine behind the site's pricing, risk and portfolio tools, and uses it in every 1-on-1 session.$$,
        '["MSc Data Science", "CFA Level III Candidate", "FRM Part I Passed"]',
        '["CFA®", "FRM®", "Python", "Risk & VaR"]',
        0, true
      )`,
    ],
  },
  {
    id: "008_consultancy_tickers",
    statements: [
      // Consultancy clients can leave feedback too.
      `ALTER TABLE testimonials DROP CONSTRAINT testimonials_ticker_check`,
      `ALTER TABLE testimonials ADD CONSTRAINT testimonials_ticker_check
        CHECK (ticker IN ('CFA1', 'CFA2', 'FRM1', 'UNI', 'PSX', 'QUANT', 'BIZCON', 'FINCON'))`,
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
