import type { AdminRole } from "../types";

export interface AdminModule {
  href: string;
  label: string;
  /** Not built yet: shown greyed out so the roadmap is visible. */
  comingSoon?: boolean;
  /** Billing: hidden from editors (the pages refuse them too). */
  ownerOnly?: boolean;
}

/** Sections of the admin panel. Add a module here when its pages exist. */
export class AdminNavigation {
  private static readonly MODULES: readonly AdminModule[] = [
    { href: "/admin", label: "Dashboard", ownerOnly: true },
    { href: "/admin/schedule", label: "Schedule" },
    { href: "/admin/invoices", label: "Invoices", ownerOnly: true },
    { href: "/admin/clients", label: "Clients", ownerOnly: true },
    { href: "/admin/services", label: "Services", ownerOnly: true },
    { href: "/admin/journal", label: "Research Terminal" },
    { href: "/admin/testimonials", label: "Testimonials" },
    { href: "/admin/instructors", label: "Instructors" },
    { href: "/admin/courses", label: "Courses" },
    { href: "/admin/pricing", label: "Pricing", comingSoon: true },
    { href: "/admin/settings", label: "Settings", ownerOnly: true },
    { href: "/admin/account", label: "Account" },
  ];

  /** The modules this role can open. */
  all(role: AdminRole): readonly AdminModule[] {
    return role === "owner" ? AdminNavigation.MODULES : AdminNavigation.MODULES.filter((module) => !module.ownerOnly);
  }
}
