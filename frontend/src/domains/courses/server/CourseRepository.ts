import "server-only";

import { Database, type Sql } from "@/core/db/Database";

import { CourseFormat } from "../services/CourseFormat";
import type { Course } from "../types";

interface CourseRow {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  start_date: string | null;
  duration: string;
  price_minor: number | null;
  currency: string;
  is_active: boolean;
  syllabus: unknown;
  brochure_url: string | null;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Read side of the course catalogue. Schema: scripts/db/migrate.mts (003_courses). */
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
