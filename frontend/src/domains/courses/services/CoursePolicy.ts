import type { AdminUser } from "@/domains/admin/types";

/**
 * Who may do what with a course. Owners do everything; editors work on
 * drafts only, so nothing an editor saves goes live without an owner.
 */
export class CoursePolicy {
  /** Saving moves a course from `wasLive` to `willBeLive`. */
  static canSave(user: AdminUser, wasLive: boolean, willBeLive: boolean): boolean {
    return user.role === "owner" || (!wasLive && !willBeLive);
  }

  static canPublish(user: AdminUser): boolean {
    return user.role === "owner";
  }

  static canDelete(user: AdminUser): boolean {
    return user.role === "owner";
  }
}
