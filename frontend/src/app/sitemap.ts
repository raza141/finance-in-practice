import type { MetadataRoute } from "next";

import { siteConfig } from "@/core/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    { path: "", priority: 1 },
    { path: "/consulting", priority: 0.8 },
    { path: "/about", priority: 0.7 },
    { path: "/contact", priority: 0.6 },
    { path: "/cohort", priority: 0.5 },
    { path: "/journal", priority: 0.5 },
    { path: "/testimonials/submit", priority: 0.3 },
  ];
  return routes.map(({ path, priority }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority,
  }));
}
