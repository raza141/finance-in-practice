import type { AdminRole } from "../types";

export type AdminIconName =
  | "dashboard"
  | "calendar"
  | "people"
  | "clock"
  | "receipt"
  | "inbox"
  | "tag"
  | "question"
  | "school"
  | "book"
  | "user"
  | "pen"
  | "star"
  | "play"
  | "chat"
  | "gear"
  | "key"
  | "chart";

export interface AdminModule {
  href: string;
  label: string;
  icon: AdminIconName;
  /** Not built yet: shown greyed out so the roadmap is visible. */
  comingSoon?: boolean;
  /** Billing: hidden from editors (the pages refuse them too). */
  ownerOnly?: boolean;
}

export interface AdminGroup {
  label: string;
  modules: AdminModule[];
}

/**
 * Sections of the admin panel, grouped by how often they're used: the day's
 * work first, setup last. Add a module here when its pages exist.
 */
export class AdminNavigation {
  private static readonly GROUPS: readonly AdminGroup[] = [
    {
      label: "Today",
      modules: [
        { href: "/admin", label: "Dashboard", icon: "dashboard", ownerOnly: true },
        { href: "/admin/schedule", label: "Schedule", icon: "calendar" },
        { href: "/admin/clients", label: "Clients", icon: "people", ownerOnly: true },
        { href: "/admin/hours", label: "Hours & pay", icon: "clock", ownerOnly: true },
      ],
    },
    {
      label: "Money",
      modules: [
        { href: "/admin/invoices", label: "Billing & quotes", icon: "receipt", ownerOnly: true },
        { href: "/admin/leads", label: "Leads", icon: "inbox", ownerOnly: true },
        { href: "/admin/services", label: "Services & prices", icon: "tag", ownerOnly: true },
        { href: "/admin/pricing", label: "Pricing", icon: "chart", ownerOnly: true },
      ],
    },
    {
      label: "Teaching",
      modules: [
        { href: "/admin/questions", label: "CFA questions", icon: "question" },
        { href: "/admin/mocks", label: "Mock exams", icon: "clock" },
        { href: "/admin/mocks/practice", label: "Practice sets", icon: "clock" },
        { href: "/admin/mocks/bank", label: "Question bank", icon: "clock" },
        { href: "/admin/classroom", label: "Classroom", icon: "school", ownerOnly: true },
        { href: "/admin/courses", label: "Courses", icon: "book" },
        { href: "/admin/instructors", label: "Instructors", icon: "user" },
      ],
    },
    {
      label: "Website",
      modules: [
        { href: "/admin/journal", label: "Blog", icon: "pen" },
        { href: "/admin/testimonials", label: "Testimonials", icon: "star" },
        { href: "/admin/videos", label: "Videos", icon: "play" },
      ],
    },
    {
      label: "Setup",
      modules: [
        { href: "/admin/whatsapp", label: "WhatsApp", icon: "chat", ownerOnly: true },
        { href: "/admin/settings", label: "Settings", icon: "gear", ownerOnly: true },
        { href: "/admin/account", label: "Account", icon: "key" },
      ],
    },
  ];

  /** The groups this role can open (empty groups dropped). */
  groups(role: AdminRole): AdminGroup[] {
    return AdminNavigation.GROUPS.map((g) => ({ ...g, modules: g.modules.filter((m) => role === "owner" || !m.ownerOnly) })).filter((g) => g.modules.length > 0);
  }

  /** The modules this role can open. */
  all(role: AdminRole): AdminModule[] {
    return this.groups(role).flatMap((g) => g.modules);
  }

  /** Whether `href` is the section for `pathname` (the dashboard only on its own page). */
  static isActive(href: string, pathname: string): boolean {
    return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
  }
}
