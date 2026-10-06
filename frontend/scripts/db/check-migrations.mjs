/**
 * Deploy guard: a production build stops when the code needs a migration the
 * production database hasn't had (run its SQL first; see migrate.mts --print).
 * Runs before `next build`. Only a confirmed missing migration fails the
 * build; anything else (preview builds, no URL, no network) just warns.
 */
import { readFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

if (process.env.VERCEL_ENV !== "production") process.exit(0);

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
if (!url) {
  console.warn("[migrations] DATABASE_URL not set at build time; skipping the check.");
  process.exit(0);
}

const source = await readFile(new URL("./migrate.mts", import.meta.url), "utf8");
const ids = [...source.matchAll(/^\s*id: "(\d{3}_[a-z0-9_]+)",/gm)].map((match) => match[1]);

let applied;
try {
  const rows = await neon(url)`SELECT id FROM schema_migrations`;
  applied = new Set(rows.map((row) => row.id));
} catch (error) {
  console.warn(`[migrations] Could not read schema_migrations (${error.message}); skipping the check.`);
  process.exit(0);
}

const pending = ids.filter((id) => !applied.has(id));
if (pending.length > 0) {
  console.error(`[migrations] Production database is missing: ${pending.join(", ")}.`);
  console.error("[migrations] Run each with `npm run db:migrate -- --print <id>` in the query editor, then redeploy.");
  process.exit(1);
}
console.log(`[migrations] Production schema is current (${ids.length} migrations).`);
