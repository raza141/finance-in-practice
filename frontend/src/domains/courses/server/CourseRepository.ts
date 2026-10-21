import "server-only";

import { Database, type Sql } from "@/core/db/Database";
import type { Ticker } from "@/domains/testimonials/types";

import type { CourseInput } from "../services/CourseContract";
import { CourseFormat } from "../services/CourseFormat";
import type { Course, CourseCategory } from "../types";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  category: CourseCategory;
  eyebrow: string;
  tagline: string;
  summary: string;
  audience: string;
  not_for: string;
  difference: string;
  disclaimer: string;
  cta_label: string;
  booking_url: string;
  coaching_label: string;
  practice_label: string;
  weight_label: string;
  start_date: string | null;
  duration: string;
  price_minor: number | null;
  currency: string;
  is_active: boolean;
  method: unknown;
  modes: unknown;
  modules: unknown;
  options: unknown;
  faqs: unknown;
  brochure_url: string | null;
  seo_title: string;
  seo_description: string;
  testimonial_ticker: Ticker | null;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Thrown when another course already uses the slug. */
export class DuplicateSlugError extends Error {
  constructor(slug: string) {
    super(`A course with the slug "${slug}" already exists.`);
    this.name = "DuplicateSlugError";
  }
}

const isUniqueViolation = (error: unknown) =>
  typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";

/** The course catalogue. Schema: scripts/db/migrate.mts (003_courses, 015_course_cms). */
export class CourseRepository {
  /** Every column a Course needs; updated_by stays admin-side. */
  private static readonly COLUMNS = `id, slug, title, category, eyebrow, tagline, summary, audience, not_for, difference, disclaimer,
    cta_label, booking_url, coaching_label, practice_label, weight_label, start_date::text AS start_date, duration, price_minor,
    currency, is_active, method, modes, modules, options, faqs, brochure_url, seo_title, seo_description, testimonial_ticker`;

  constructor(private readonly sql: Sql) {}

  static fromEnv(): CourseRepository | null {
    const sql = Database.sql();
    return sql ? new CourseRepository(sql) : null;
  }

  /** The published course with this slug, or null. Drafts never leave this method. */
  async activeBySlug(slug: string): Promise<Course | null> {
    if (!SLUG.test(slug) || slug.length > 80) return null;
    const [row] = (await this.sql.query(`SELECT ${CourseRepository.COLUMNS} FROM courses WHERE slug = $1 AND is_active`, [
      slug,
    ])) as CourseRow[];
    return row ? CourseRepository.toCourse(row) : null;
  }

  /** Every published course, for the /courses overview. */
  async active(): Promise<Course[]> {
    const rows = (await this.sql.query(
      `SELECT ${CourseRepository.COLUMNS} FROM courses WHERE is_active ORDER BY start_date NULLS LAST, title`,
    )) as CourseRow[];
    return rows.map(CourseRepository.toCourse);
  }

  /** Slug and last edit of every published course, for the sitemap. */
  async activeSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    const rows = (await this.sql`
      SELECT slug, updated_at FROM courses WHERE is_active ORDER BY slug
    `) as { slug: string; updated_at: Date | string }[];
    return rows.map((row) => ({ slug: row.slug, updatedAt: new Date(row.updated_at) }));
  }

  /** Every course, published or not, for the admin. */
  async all(): Promise<Course[]> {
    const rows = (await this.sql.query(
      `SELECT ${CourseRepository.COLUMNS} FROM courses ORDER BY is_active DESC, category, title`,
    )) as CourseRow[];
    return rows.map(CourseRepository.toCourse);
  }

  async byId(id: string): Promise<Course | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql.query(`SELECT ${CourseRepository.COLUMNS} FROM courses WHERE id = $1`, [id])) as CourseRow[];
    return row ? CourseRepository.toCourse(row) : null;
  }

  async create(input: CourseInput, isActive: boolean, adminId: string): Promise<string> {
    try {
      const [row] = (await this.sql`
        INSERT INTO courses (slug, title, category, eyebrow, tagline, summary, audience, not_for, difference, disclaimer,
                             cta_label, booking_url, coaching_label, practice_label, weight_label, start_date, duration, price_minor,
                             currency, is_active, method, modes, modules, options, faqs, brochure_url, seo_title,
                             seo_description, testimonial_ticker, updated_by)
        VALUES (${input.slug}, ${input.title}, ${input.category}, ${input.eyebrow}, ${input.tagline}, ${input.summary}, ${input.audience},
                ${input.notFor}, ${input.difference}, ${input.disclaimer}, ${input.ctaLabel}, ${input.bookingUrl},
                ${input.coachingLabel}, ${input.practiceLabel}, ${input.weightLabel}, ${input.startDate}, ${input.duration},
                ${input.priceMinor}, ${input.currency}, ${isActive}, ${JSON.stringify(input.method)}::jsonb, ${JSON.stringify(input.modes)}::jsonb,
                ${JSON.stringify(input.modules)}::jsonb, ${JSON.stringify(input.options)}::jsonb,
                ${JSON.stringify(input.faqs)}::jsonb, ${input.brochureUrl}, ${input.seoTitle}, ${input.seoDescription},
                ${input.testimonialTicker}, ${adminId})
        RETURNING id
      `) as { id: string }[];
      return row.id;
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateSlugError(input.slug);
      throw error;
    }
  }

  /** Returns the slug the course had before the update (to revalidate its old URL), or null if not found. */
  async update(id: string, input: CourseInput, isActive: boolean, adminId: string): Promise<string | null> {
    if (!UUID.test(id)) return null;
    try {
      const [row] = (await this.sql`
        UPDATE courses AS c SET
          slug = ${input.slug}, title = ${input.title}, category = ${input.category}, eyebrow = ${input.eyebrow}, tagline = ${input.tagline},
          summary = ${input.summary}, audience = ${input.audience}, not_for = ${input.notFor},
          difference = ${input.difference}, disclaimer = ${input.disclaimer}, cta_label = ${input.ctaLabel},
          booking_url = ${input.bookingUrl}, coaching_label = ${input.coachingLabel},
          practice_label = ${input.practiceLabel}, weight_label = ${input.weightLabel}, start_date = ${input.startDate}, duration = ${input.duration},
          price_minor = ${input.priceMinor}, currency = ${input.currency}, is_active = ${isActive},
          method = ${JSON.stringify(input.method)}::jsonb, modes = ${JSON.stringify(input.modes)}::jsonb,
          modules = ${JSON.stringify(input.modules)}::jsonb,
          options = ${JSON.stringify(input.options)}::jsonb, faqs = ${JSON.stringify(input.faqs)}::jsonb,
          brochure_url = ${input.brochureUrl}, seo_title = ${input.seoTitle}, seo_description = ${input.seoDescription},
          testimonial_ticker = ${input.testimonialTicker}, updated_by = ${adminId}, updated_at = now()
        FROM courses AS old
        WHERE c.id = ${id} AND old.id = c.id
        RETURNING old.slug AS previous_slug
      `) as { previous_slug: string }[];
      return row?.previous_slug ?? null;
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateSlugError(input.slug);
      throw error;
    }
  }

  /** Returns the course's slug, or null if not found. */
  async setActive(id: string, active: boolean, adminId: string): Promise<string | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      UPDATE courses SET is_active = ${active}, updated_by = ${adminId}, updated_at = now() WHERE id = ${id} RETURNING slug
    `) as { slug: string }[];
    return row?.slug ?? null;
  }

  /** Returns the deleted course's slug, or null if not found. */
  async remove(id: string): Promise<string | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`DELETE FROM courses WHERE id = ${id} RETURNING slug`) as { slug: string }[];
    return row?.slug ?? null;
  }

  private static toCourse(row: CourseRow): Course {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      category: row.category,
      eyebrow: row.eyebrow,
      tagline: row.tagline,
      summary: row.summary,
      audience: row.audience,
      notFor: row.not_for,
      difference: row.difference,
      disclaimer: row.disclaimer,
      ctaLabel: row.cta_label,
      bookingUrl: row.booking_url,
      coachingLabel: row.coaching_label,
      practiceLabel: row.practice_label,
      weightLabel: row.weight_label,
      startDate: row.start_date,
      duration: row.duration,
      priceMinor: row.price_minor,
      currency: row.currency,
      isActive: row.is_active,
      method: CourseFormat.method(row.method),
      modes: CourseFormat.method(row.modes),
      modules: CourseFormat.modules(row.modules),
      options: CourseFormat.options(row.options),
      faqs: CourseFormat.faqs(row.faqs),
      brochureUrl: row.brochure_url,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      testimonialTicker: row.testimonial_ticker,
    };
  }
}
