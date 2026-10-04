import "server-only";

import { unstable_rethrow } from "next/navigation";

import { Database, type Sql } from "@/core/db/Database";

import type { InstructorInput } from "../services/InstructorContract";
import type { Instructor } from "../types";

interface InstructorRow {
  id: string;
  name: string;
  role: string;
  bio: string;
  background: string;
  education: unknown;
  highlights: unknown;
  photo_url: string | null;
  sort_order: number;
  is_active: boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/** The teaching team. Schema: scripts/db/migrate.mts (007_instructors). */
export class InstructorRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): InstructorRepository | null {
    const sql = Database.sql();
    return sql ? new InstructorRepository(sql) : null;
  }

  /** Published instructors; none when the database is unset or unreachable, rather than failing the page. */
  static async published(): Promise<Instructor[]> {
    try {
      return (await InstructorRepository.fromEnv()?.active()) ?? [];
    } catch (error) {
      // Let Next.js prerender signals through instead of baking in an empty team.
      unstable_rethrow(error);
      console.error("[team] could not load instructors", error);
      return [];
    }
  }

  /** Published instructors in display order, for /about and the home teaser. */
  async active(): Promise<Instructor[]> {
    const rows = (await this.sql`
      SELECT id, name, role, bio, background, education, highlights, photo_url, sort_order, is_active
      FROM instructors
      WHERE is_active
      ORDER BY sort_order, created_at
    `) as InstructorRow[];
    return rows.map(InstructorRepository.toInstructor);
  }

  /** Every instructor, published or not, for the admin list. */
  async all(): Promise<Instructor[]> {
    const rows = (await this.sql`
      SELECT id, name, role, bio, background, education, highlights, photo_url, sort_order, is_active
      FROM instructors
      ORDER BY sort_order, created_at
    `) as InstructorRow[];
    return rows.map(InstructorRepository.toInstructor);
  }

  async byId(id: string): Promise<Instructor | null> {
    if (!UUID.test(id)) return null;
    const [row] = (await this.sql`
      SELECT id, name, role, bio, background, education, highlights, photo_url, sort_order, is_active
      FROM instructors
      WHERE id = ${id}
    `) as InstructorRow[];
    return row ? InstructorRepository.toInstructor(row) : null;
  }

  async create(input: InstructorInput): Promise<void> {
    await this.sql`
      INSERT INTO instructors (name, role, bio, background, education, highlights, photo_url, sort_order, is_active)
      VALUES (${input.name}, ${input.role}, ${input.bio}, ${input.background},
              ${JSON.stringify(input.education)}::jsonb, ${JSON.stringify(input.highlights)}::jsonb,
              ${input.photo}, ${input.sortOrder}, ${input.isActive})
    `;
  }

  /** False when the instructor no longer exists. */
  async update(id: string, input: InstructorInput): Promise<boolean> {
    if (!UUID.test(id)) return false;
    const rows = (await this.sql`
      UPDATE instructors SET
        name = ${input.name}, role = ${input.role}, bio = ${input.bio}, background = ${input.background},
        education = ${JSON.stringify(input.education)}::jsonb, highlights = ${JSON.stringify(input.highlights)}::jsonb,
        photo_url = ${input.photo}, sort_order = ${input.sortOrder}, is_active = ${input.isActive},
        updated_at = now()
      WHERE id = ${id}
      RETURNING id
    `) as { id: string }[];
    return rows.length > 0;
  }

  async setActive(id: string, active: boolean): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`UPDATE instructors SET is_active = ${active}, updated_at = now() WHERE id = ${id}`;
  }

  async remove(id: string): Promise<void> {
    if (!UUID.test(id)) return;
    await this.sql`DELETE FROM instructors WHERE id = ${id}`;
  }

  private static toInstructor(row: InstructorRow): Instructor {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      bio: row.bio,
      background: row.background,
      education: strings(row.education),
      highlights: strings(row.highlights),
      photo: row.photo_url ?? undefined,
      sortOrder: row.sort_order,
      isActive: row.is_active,
    };
  }
}
