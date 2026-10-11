"use client";

import { Analytics } from "@vercel/analytics/next";

/** Vercel Web Analytics, minus admin pages and private invoice links (their URLs carry an access token). */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        const { pathname } = new URL(event.url);
        return pathname.startsWith("/admin") || pathname.startsWith("/invoice/") ? null : event;
      }}
    />
  );
}
