/**
 * owner: publishes directly and approves others' work.
 * editor: writes drafts and submits them for the owner's review.
 */
export type AdminRole = "owner" | "editor";

/** A signed-in admin, as exposed to pages. Never carries the password hash. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  hasPassword: boolean;
  googleLinked: boolean;
}
