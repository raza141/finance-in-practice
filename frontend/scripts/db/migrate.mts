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

/** Seed for 009_articles: the Journal's first article, formerly hard-coded in JournalCatalog. */
const VAR_ARTICLE = {
  title: "Three ways to compute Value at Risk",
  slug: "three-ways-to-compute-var",
  subtitle: "",
  excerpt:
    "Parametric, historical and Monte Carlo VaR answer the same question with different assumptions. Here is when each one earns its place.",
  format: "Explainer",
  category: "FRM & Risk Management",
  difficulty: "Intermediate",
  audience: ["FRM Part I", "Risk Professional"],
  tags: ["Risk", "FRM", "Python"],
  featuredImage: null,
  seo: {
    title: "",
    description: "Parametric, historical and Monte Carlo VaR answer the same question with different assumptions. When each one earns its place.",
    canonical: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
  },
  social: { hook: "", body: "", question: "", hashtags: [], imageUrl: "", carousel: [], status: "not-started" },
  cta: null,
  disclaimer: "",
  sources: [],
  blocks: [
    { id: "intro", type: "text", text: "Value at Risk asks one question: over a given horizon, what loss will not be exceeded with a given confidence? A one-day 99% VaR of 1 million means that on 99 days out of 100 the portfolio should lose less than 1 million. The three standard methods differ only in how they model the distribution of returns." },
    { id: "h-param", type: "heading", level: 2, text: "Parametric (variance-covariance)" },
    { id: "param", type: "text", text: "Assume returns are normally distributed, estimate the portfolio's volatility from the covariance matrix, and scale it by the z-score for the chosen confidence level (2.33 at 99%). It is fast and transparent, which is why it dominates exam questions, but it understates fat-tailed losses." },
    { id: "h-hist", type: "heading", level: 2, text: "Historical simulation" },
    { id: "hist", type: "text", text: "Revalue today's portfolio under every daily return in a look-back window, sort the resulting P&L and read off the loss at the chosen percentile. No distribution is assumed, so fat tails and skew in the data come through, but the answer is only as good as the window: a calm year produces a calm VaR." },
    { id: "h-mc", type: "heading", level: 2, text: "Monte Carlo simulation" },
    { id: "mc", type: "text", text: "Specify a model for the risk factors, simulate thousands of scenarios, revalue the portfolio in each and take the percentile. It handles options and other non-linear payoffs that the parametric method gets wrong, at the cost of computation time and model risk." },
    { id: "h-which", type: "heading", level: 2, text: "Which one to use" },
    { id: "which", type: "text", text: "For a linear portfolio and a quick answer, parametric VaR is fine. For realistic tails with enough data, use historical simulation. For options books or path-dependent exposure, Monte Carlo is the honest choice. In practice, run more than one: when they disagree, the disagreement is the insight." },
  ],
};

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
  {
    id: "009_articles",
    statements: [
      // Research-article roles: owners publish directly and approve; editors
      // submit for review. Everyone who is an admin today is the owner.
      `ALTER TABLE admin_users ADD COLUMN role text NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'editor'))`,
      `UPDATE admin_users SET role = 'owner'`,
      // One row per article. The body is a JSON document (see
      // src/domains/journal/types.ts ArticleDocument): `draft` is what the
      // editor autosaves, `published` is the snapshot readers see, so a live
      // article can be edited for days without leaking half-done changes.
      // The filter columns mirror the published snapshot (or the draft until
      // the first publish). A future date_published means "scheduled".
      // Keep the lists in sync with JournalTaxonomy.
      `CREATE TABLE articles (
        id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        slug           text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(slug) <= 100),
        status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published', 'archived')),
        author_id      uuid NOT NULL REFERENCES admin_users (id),
        format         text NOT NULL CHECK (format IN ('Explainer', 'Worked Example', 'Case Study', 'Python Notebook',
                         'Market Note', 'Research Commentary', 'Framework')),
        category       text CHECK (category IN ('CFA Curriculum', 'FRM & Risk Management', 'Quantitative Finance',
                         'Portfolio Management', 'Valuation & Financial Modeling', 'Python & Financial Data',
                         'Markets: Pakistan, UAE & Global')),
        difficulty     text CHECK (difficulty IN ('Foundation', 'Intermediate', 'Advanced')),
        audience       text[] NOT NULL DEFAULT '{}',
        tags           text[] NOT NULL DEFAULT '{}',
        draft          jsonb NOT NULL CHECK (jsonb_typeof(draft) = 'object'),
        published      jsonb CHECK (jsonb_typeof(published) = 'object'),
        review_note    text CHECK (char_length(review_note) <= 2000),
        ai_review      jsonb,
        date_published timestamptz,
        date_modified  timestamptz,
        version        integer NOT NULL DEFAULT 1,
        created_at     timestamptz NOT NULL DEFAULT now(),
        updated_at     timestamptz NOT NULL DEFAULT now(),
        CHECK (status <> 'published' OR (published IS NOT NULL AND date_published IS NOT NULL AND date_modified IS NOT NULL))
      )`,
      `CREATE INDEX articles_public_idx ON articles (status, date_published DESC)`,
      `CREATE INDEX articles_tags_idx ON articles USING gin (tags)`,
      `CREATE INDEX articles_author_idx ON articles (author_id)`,
      // Snapshots: every publish, manual checkpoint (Cmd+S), submit and restore.
      `CREATE TABLE article_revisions (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        article_id uuid NOT NULL REFERENCES articles (id) ON DELETE CASCADE,
        kind       text NOT NULL CHECK (kind IN ('publish', 'checkpoint', 'restore', 'submit')),
        document   jsonb NOT NULL,
        created_by uuid REFERENCES admin_users (id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX article_revisions_article_idx ON article_revisions (article_id, created_at DESC)`,
      // The article that used to be hard-coded in JournalCatalog, so its URL keeps working.
      `INSERT INTO articles (slug, status, author_id, format, category, difficulty, audience, tags, draft, published,
                             date_published, date_modified)
       SELECT 'three-ways-to-compute-var', 'published', id, 'Explainer', 'FRM & Risk Management', 'Intermediate',
              '{FRM Part I,Risk Professional}', '{Risk,FRM,Python}', doc, doc,
              '2026-10-04T00:00:00+04:00', '2026-10-04T00:00:00+04:00'
       FROM admin_users, (SELECT $seed$${JSON.stringify(VAR_ARTICLE)}$seed$::jsonb AS doc) AS seed
       WHERE role = 'owner' ORDER BY created_at LIMIT 1`,
    ],
  },
  {
    id: "010_article_review",
    statements: [
      // Review moves out of status into its own column, so a live article
      // stays live while an editor's changes to it wait for the owner.
      `ALTER TABLE articles DROP CONSTRAINT articles_status_check`,
      `UPDATE articles SET status = 'draft' WHERE status = 'review'`,
      `ALTER TABLE articles ADD CONSTRAINT articles_status_check CHECK (status IN ('draft', 'published', 'archived'))`,
      `ALTER TABLE articles ADD COLUMN review_state text CHECK (review_state IN ('pending', 'changes-requested'))`,
      `CREATE INDEX articles_review_idx ON articles (review_state) WHERE review_state IS NOT NULL`,
    ],
  },
  {
    id: "011_booking_blocks",
    statements: [
      // Time the owner blocks from the admin Schedule page (offline clients,
      // personal time). The public slots API drops any slot that overlaps one,
      // and booking a blocked slot is refused. 012 is reserved for invoices.
      `CREATE TABLE booking_blocks (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        starts_at   timestamptz NOT NULL,
        ends_at     timestamptz NOT NULL,
        reason      text NOT NULL DEFAULT '' CHECK (char_length(reason) <= 120),
        created_by  uuid REFERENCES admin_users (id) ON DELETE SET NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),
        CHECK (ends_at > starts_at AND ends_at - starts_at <= interval '31 days')
      )`,
      `CREATE INDEX booking_blocks_range_idx ON booking_blocks (ends_at, starts_at)`,
    ],
  },
  {
    id: "012_invoices",
    statements: [
      // Invoice numbers come from one sequence, drawn only by the UPDATE that
      // issues a draft, so numbers are never reused and never skipped.
      // Shown as FIP-<issue year>-<seq padded to 4>.
      `CREATE SEQUENCE invoice_number_seq`,
      // Drafts are editable; once issued (sent) the content is a frozen
      // snapshot and only the status moves on (paid or void). Amounts are
      // integer minor units, computed server-side. items is
      // [{description, quantity, unitMinor, amountMinor}]. token keys the
      // public /invoice/<token> page.
      `CREATE TABLE invoices (
        id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        number_seq           integer UNIQUE,
        token                text NOT NULL UNIQUE CHECK (char_length(token) BETWEEN 32 AND 64),
        status               text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
        booking_uid          text CHECK (char_length(booking_uid) <= 100),
        client_name          text NOT NULL CHECK (char_length(client_name) BETWEEN 1 AND 120),
        client_email         text NOT NULL CHECK (char_length(client_email) <= 254),
        currency             text NOT NULL CHECK (currency IN ('AED', 'USD', 'PKR', 'GBP', 'EUR')),
        items                jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array'),
        subtotal_minor       integer NOT NULL CHECK (subtotal_minor >= 0),
        discount_minor       integer NOT NULL DEFAULT 0 CHECK (discount_minor >= 0 AND discount_minor <= subtotal_minor),
        tax_rate_bp          integer NOT NULL DEFAULT 0 CHECK (tax_rate_bp BETWEEN 0 AND 10000),
        tax_minor            integer NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
        total_minor          integer NOT NULL CHECK (total_minor >= 0),
        trn                  text NOT NULL DEFAULT '' CHECK (char_length(trn) <= 30),
        due_date             date NOT NULL,
        notes                text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 2000),
        payment_instructions text NOT NULL DEFAULT '' CHECK (char_length(payment_instructions) <= 2000),
        issue_date           date,
        created_at           timestamptz NOT NULL DEFAULT now(),
        updated_at           timestamptz NOT NULL DEFAULT now(),
        sent_at              timestamptz,
        paid_at              timestamptz,
        voided_at            timestamptz,
        CHECK ((status = 'draft') = (number_seq IS NULL)),
        CHECK ((status = 'draft') = (issue_date IS NULL))
      )`,
      `CREATE INDEX invoices_created_idx ON invoices (created_at DESC)`,
      `CREATE INDEX invoices_booking_idx ON invoices (booking_uid) WHERE booking_uid IS NOT NULL`,
      // Every email the admin panel sends (invoices, booking confirmations).
      `CREATE TABLE email_log (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        kind         text NOT NULL CHECK (kind IN ('invoice', 'confirmation')),
        to_email     text NOT NULL CHECK (char_length(to_email) <= 254),
        subject      text NOT NULL CHECK (char_length(subject) <= 300),
        invoice_id   uuid REFERENCES invoices (id) ON DELETE SET NULL,
        booking_uid  text CHECK (char_length(booking_uid) <= 100),
        provider_id  text,
        sent_at      timestamptz NOT NULL DEFAULT now()
      )`,
      `CREATE INDEX email_log_sent_idx ON email_log (sent_at DESC)`,
      `CREATE INDEX email_log_invoice_idx ON email_log (invoice_id) WHERE invoice_id IS NOT NULL`,
      `CREATE INDEX email_log_booking_idx ON email_log (booking_uid) WHERE booking_uid IS NOT NULL`,
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

// `npm run db:migrate -- --print 009_articles` prints one migration as a single
// line of SQL to paste into the Vercel/Neon query editor (production has no
// local URL). It also records the migration, so db:migrate later skips it.
const printIndex = process.argv.indexOf("--print");
if (printIndex !== -1) {
  const migration = MIGRATIONS.find((m) => m.id === process.argv[printIndex + 1]);
  if (!migration) {
    console.error(`Unknown migration. Known: ${MIGRATIONS.map((m) => m.id).join(", ")}`);
    process.exit(1);
  }
  const statements = [...migration.statements, `INSERT INTO schema_migrations (id) VALUES ('${migration.id}')`];
  // One line, one statement: the Vercel query editor takes a single line and
  // runs it as one prepared statement. A DO block is a single statement and
  // runs atomically, like the transaction db:migrate uses.
  const body = statements.map((st) => st.replace(/\s*\n\s*/g, " ")).join("; ");
  if (body.includes("$migrate$")) throw new Error("Statement contains the DO block delimiter $migrate$");
  console.log(`DO $migrate$ BEGIN ${body}; END $migrate$`);
  process.exit(0);
}

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to frontend/.env.local (see .env.example).");
  process.exit(1);
}

await new SchemaMigrator(neon(url), MIGRATIONS).run();
