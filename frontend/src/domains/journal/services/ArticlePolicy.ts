import type { AdminUser } from "@/domains/admin/types";

import type { ArticleRecord } from "../types";

/**
 * Who may do what with an article. Owners publish directly (their own work
 * is approved on save, no review); editors write their own drafts and submit
 * them to an owner.
 */
export class ArticlePolicy {
  static canEdit(user: AdminUser, article: Pick<ArticleRecord, "authorId">): boolean {
    return user.role === "owner" || article.authorId === user.id;
  }

  static canPublish(user: AdminUser): boolean {
    return user.role === "owner";
  }

  /** Editors' list shows only their own articles. */
  static listScope(user: AdminUser): string | null {
    return user.role === "owner" ? null : user.id;
  }
}
