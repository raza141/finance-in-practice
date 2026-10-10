/**
 * Loads the course snapshots in scripts/db/seeds/ into the database in
 * DATABASE_URL (the dev database in .env.local), so local pages match the
 * live site:
 *
 *   npm run db:seed
 *
 * Re-running refreshes each course to its snapshot. Not a migration: it never
 * runs against production unless DATABASE_URL points there.
 */
import { readdir, readFile } from "node:fs/promises";

import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set (add it to .env.local).");
const sql = neon(url);
console.log(`Seeding ${new URL(url).host}`);

const dir = new URL("./seeds/", import.meta.url);
for (const file of (await readdir(dir)).filter((name) => name.endsWith(".json"))) {
  const c = JSON.parse(await readFile(new URL(file, dir), "utf8"));
  await sql`
    INSERT INTO courses (slug, title, category, eyebrow, tagline, summary, audience, not_for, difference, disclaimer,
                         cta_label, booking_url, coaching_label, practice_label, weight_label, start_date, duration, price_minor,
                         currency, is_active, method, modes, modules, options, faqs, brochure_url, seo_title,
                         seo_description, testimonial_ticker)
    VALUES (${c.slug}, ${c.title}, ${c.category}, ${c.eyebrow}, ${c.tagline}, ${c.summary}, ${c.audience}, ${c.notFor},
            ${c.difference}, ${c.disclaimer}, ${c.ctaLabel}, ${c.bookingUrl}, ${c.coachingLabel}, ${c.practiceLabel},
            ${c.weightLabel}, ${c.startDate}, ${c.duration}, ${c.priceMinor}, ${c.currency}, ${c.isActive},
            ${JSON.stringify(c.method)}::jsonb, ${JSON.stringify(c.modes)}::jsonb, ${JSON.stringify(c.modules)}::jsonb,
            ${JSON.stringify(c.options)}::jsonb, ${JSON.stringify(c.faqs)}::jsonb, ${c.brochureUrl}, ${c.seoTitle},
            ${c.seoDescription}, ${c.testimonialTicker})
    ON CONFLICT (slug) DO UPDATE SET
      title = EXCLUDED.title, category = EXCLUDED.category, eyebrow = EXCLUDED.eyebrow, tagline = EXCLUDED.tagline,
      summary = EXCLUDED.summary, audience = EXCLUDED.audience, not_for = EXCLUDED.not_for, difference = EXCLUDED.difference,
      disclaimer = EXCLUDED.disclaimer, cta_label = EXCLUDED.cta_label, booking_url = EXCLUDED.booking_url,
      coaching_label = EXCLUDED.coaching_label, practice_label = EXCLUDED.practice_label, weight_label = EXCLUDED.weight_label,
      start_date = EXCLUDED.start_date, duration = EXCLUDED.duration, price_minor = EXCLUDED.price_minor,
      currency = EXCLUDED.currency, is_active = EXCLUDED.is_active, method = EXCLUDED.method, modes = EXCLUDED.modes,
      modules = EXCLUDED.modules, options = EXCLUDED.options, faqs = EXCLUDED.faqs, brochure_url = EXCLUDED.brochure_url,
      seo_title = EXCLUDED.seo_title, seo_description = EXCLUDED.seo_description,
      testimonial_ticker = EXCLUDED.testimonial_ticker, updated_at = now()
  `;
  console.log(`  ${c.slug}: ${c.title}`);
}
