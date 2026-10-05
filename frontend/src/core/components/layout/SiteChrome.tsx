"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Marketing chrome (navbar, footer, chat button), hidden inside the admin panel and on client invoices. */
export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/admin" || pathname.startsWith("/admin/") || pathname.startsWith("/invoice/")) return null;
  return children;
}
