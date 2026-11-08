/**
 * owner: publishes directly and approves others' work.
 * editor: writes drafts and submits them for the owner's review.
 * qa: bug checking. Mock design and the question bank only; never client data, access grants or publishing.
 */
export type AdminRole = "owner" | "editor" | "qa";

/** A signed-in admin, as exposed to pages. Never carries the password hash. */
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  hasPassword: boolean;
  googleLinked: boolean;
}
