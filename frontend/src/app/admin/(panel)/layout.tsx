import Link from "next/link";

import { logout } from "@/domains/admin/actions/auth";
import { AdminNav, type NavBadges } from "@/domains/admin/components/AdminNav";
import { SidebarToggle } from "@/domains/admin/components/SidebarToggle";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { AdminInbox } from "@/domains/admin/server/AdminInbox";
import { AdminNavigation } from "@/domains/admin/services/AdminNavigation";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await AdminAuth.require();
  const groups = new AdminNavigation().groups(admin.role);
  // Owner only: what needs attention (one small DB query + a 2-minute cached Cal.com count).
  const inbox = admin.role === "owner" ? await AdminInbox.counts() : null;
  const badges: NavBadges = inbox
    ? {
        "/admin/clients": { count: inbox.clients, label: "new students, Classroom or package requests to look at" },
        "/admin/schedule": { count: inbox.pendingBookings, label: "bookings waiting for confirmation" },
        "/admin/hours": { count: inbox.hourRequests, label: "requests for more hours" },
      }
    : {};

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside
        data-admin-sidebar
        className="border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:overflow-y-auto md:border-r md:border-b-0"
      >
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
        <AdminNav groups={groups} badges={badges} />
        <div className="mt-auto hidden border-t border-line p-5 md:block">
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
