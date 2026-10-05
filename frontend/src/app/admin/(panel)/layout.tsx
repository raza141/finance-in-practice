import Link from "next/link";

import { logout } from "@/domains/admin/actions/auth";
import { SidebarToggle } from "@/domains/admin/components/SidebarToggle";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminNavigation } from "@/domains/admin/services/AdminNavigation";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await AdminAuth.require();
  const modules = new AdminNavigation().all();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside data-admin-sidebar className="border-b border-line bg-surface md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between p-5 md:block">
          <Link href="/admin" className="block">
            <span className="block font-mono text-[11px] tracking-[0.3em] text-quant uppercase">FIP</span>
            <span className="block font-serif text-lg italic">Admin panel</span>
          </Link>
          <form action={logout} className="md:hidden">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3">
          {modules.map((module) =>
            module.comingSoon ? (
              <span
                key={module.href}
                className="flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted/50"
              >
                {module.label}
                <span className="font-mono text-[10px] tracking-wider uppercase">Soon</span>
              </span>
            ) : (
              <Link
                key={module.href}
                href={module.href}
                className="rounded-md px-3 py-2 text-sm whitespace-nowrap text-muted transition-colors hover:bg-surface-raised hover:text-ink"
              >
                {module.label}
              </Link>
            ),
          )}
        </nav>
        <div className="hidden border-t border-line p-5 md:block">
          <p className="mb-3 truncate text-xs text-muted" title={admin.email}>
            {admin.name}
          </p>
          <Link href="/" className="block text-sm text-muted hover:text-ink">
            ← View site
          </Link>
          <form action={logout} className="mt-3">
            <button type="submit" className="text-sm text-muted hover:text-ink">
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 flex-1 p-5 sm:p-8 lg:p-10">
        <SidebarToggle />
        {children}
      </div>
    </div>
  );
}
