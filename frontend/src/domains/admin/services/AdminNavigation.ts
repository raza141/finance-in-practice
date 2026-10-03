export interface AdminModule {
  href: string;
  label: string;
  /** Not built yet: shown greyed out so the roadmap is visible. */
  comingSoon?: boolean;
}

/** Sections of the admin panel. Add a module here when its pages exist. */
export class AdminNavigation {
  private static readonly MODULES: readonly AdminModule[] = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/testimonials", label: "Testimonials" },
    { href: "/admin/instructors", label: "Instructors", comingSoon: true },
    { href: "/admin/courses", label: "Courses", comingSoon: true },
    { href: "/admin/pricing", label: "Pricing", comingSoon: true },
    { href: "/admin/account", label: "Account" },
  ];

  all(): readonly AdminModule[] {
    return AdminNavigation.MODULES;
  }
}
