"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Marketing chrome (navbar, footer, chat button), hidden inside the admin panel, on client invoices and in the student portal (it has its own bar). */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/invoice/") || pathname === "/student") return null;
  return children;
}
