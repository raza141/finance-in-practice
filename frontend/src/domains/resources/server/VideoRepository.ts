import "server-only";

import { Database, type Sql } from "@/core/db/Database";

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
}

/** YouTube videos shown on /resources (039_portal_controls), newest first. */
export class VideoRepository {
  constructor(private readonly sql: Sql) {}

  static fromEnv(): VideoRepository | null {
    const sql = Database.sql();
    return sql ? new VideoRepository(sql) : null;
  }

  async all(): Promise<Video[]> {
    const rows = (await this.sql`SELECT id, youtube_id, title FROM videos ORDER BY created_at DESC`) as { id: string; youtube_id: string; title: string }[];
    return rows.map((r) => ({ id: r.id, youtubeId: r.youtube_id, title: r.title }));
  }

  /** False when that video is already on the list. */
  async add(youtubeId: string, title: string): Promise<boolean> {
    const rows = await this.sql`INSERT INTO videos (youtube_id, title) VALUES (${youtubeId}, ${title}) ON CONFLICT (youtube_id) DO NOTHING RETURNING id`;
    return rows.length > 0;
  }

  async remove(id: string): Promise<void> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    await this.sql`DELETE FROM videos WHERE id = ${id}`;
  }
}
