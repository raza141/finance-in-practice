import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import type { CourseInput } from "../services/CourseContract";
import { CourseFormat } from "../services/CourseFormat";
import type { Course, CourseCategory } from "../types";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: CourseCategory;
  start_date: string | null;
  duration: string;
  price_minor: number | null;
  currency: string;
  is_active: boolean;
  syllabus: unknown;
  brochure_url: string | null;
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

/** The course catalogue. Schema: scripts/db/migrate.mts (003_courses). */
export class CourseRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): CourseRepository | null {
    const sql = Database.sql();
    return sql ? new CourseRepository(sql) : null;
  }

  /** The active course with this slug, or null. */
  async activeBySlug(slug: string): Promise<Course | null> {
    if (!SLUG.test(slug) || slug.length > 80) return null;
    const [row] = (await this.sql`
      SELECT id, slug, title, summary, category, start_date::text AS start_date, duration,
             price_minor, currency, is_active, syllabus, brochure_url
      FROM courses
      WHERE slug = ${slug} AND is_active
    `) as CourseRow[];
    return row ? CourseRepository.toCourse(row) : null;
  }

  /** Slug and last edit of every active course, for the sitemap. */
  async activeSlugs(): Promise<{ slug: string; updatedAt: Date }[]> {
    const rows = (await this.sql`
      SELECT slug, updated_at FROM courses WHERE is_active ORDER BY slug
    `) as { slug: string; updated_at: Date | string }[];
    return rows.map((row) => ({ slug: row.slug, updatedAt: new Date(row.updated_at) }));
  }

  /** Every course, active or not, for the admin list. */
  async all(): Promise<Course[]> {
    const rows = (await this.sql`
      SELECT id, slug, title, summary, category, start_date::text AS start_date, duration,
             price_minor, currency, is_active, syllabus, brochure_url
      FROM courses
      ORDER BY is_active DESC, start_date NULLS LAST, title
    `) as CourseRow[];
    return rows.map(CourseRepository.toCourse);
  }

  async byId(id: string): Promise<Course | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      SELECT id, slug, title, summary, category, start_date::text AS start_date, duration,
             price_minor, currency, is_active, syllabus, brochure_url
      FROM courses
      WHERE id = ${id}
    `) as CourseRow[];
    return row ? CourseRepository.toCourse(row) : null;
  }

  async create(input: CourseInput): Promise<string> {
    try {
      const [row] = (await this.sql`
        INSERT INTO courses (slug, title, summary, category, start_date, duration, price_minor, currency,
                             is_active, syllabus, brochure_url)
        VALUES (${input.slug}, ${input.title}, ${input.summary}, ${input.category}, ${input.startDate},
                ${input.duration}, ${input.priceMinor}, ${input.currency}, ${input.isActive},
                ${JSON.stringify(input.syllabus)}::jsonb, ${input.brochureUrl})
        RETURNING id
      `) as { id: string }[];
      return row.id;
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateSlugError(input.slug);
      throw error;
    }
  }

  /** Returns the slug the course had before the update (to revalidate its old URL), or null if not found. */
  async update(id: string, input: CourseInput): Promise<string | null> {
    if (!UUID.test(id)) return null;
    try {
      const [row] = (await this.sql`
        UPDATE courses AS c SET
          slug = ${input.slug}, title = ${input.title}, summary = ${input.summary}, category = ${input.category},
          start_date = ${input.startDate}, duration = ${input.duration}, price_minor = ${input.priceMinor},
          currency = ${input.currency}, is_active = ${input.isActive},
          syllabus = ${JSON.stringify(input.syllabus)}::jsonb, brochure_url = ${input.brochureUrl},
          updated_at = now()
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
  async setActive(id: string, active: boolean): Promise<string | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      UPDATE courses SET is_active = ${active}, updated_at = now() WHERE id = ${id} RETURNING slug
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
      summary: row.summary,
      category: row.category,
      startDate: row.start_date,
      duration: row.duration,
      priceMinor: row.price_minor,
      currency: row.currency,
      isActive: row.is_active,
      syllabus: CourseFormat.syllabus(row.syllabus),
      brochureUrl: row.brochure_url,
    };
  }
}
