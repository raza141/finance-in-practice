import type { MetadataRoute } from "next";

import { siteConfig } from "@/core/config/site";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { JournalCatalog } from "@/domains/journal/services/JournalCatalog";

// Cached like a page and refreshed hourly; course saves in admin also revalidate it.
export const revalidate = 3600;

const STATIC_ROUTES = [
  { path: "", priority: 1 },
  { path: "/courses", priority: 0.9 },
  { path: "/consulting", priority: 0.8 },
  { path: "/about", priority: 0.7 },
  { path: "/contact", priority: 0.6 },
  { path: "/cohort", priority: 0.5 },
  { path: "/journal", priority: 0.5 },
  { path: "/testimonials/submit", priority: 0.3 },
];

/** Active courses, or none when the database is unset or unreachable (e.g. at build time). */
async function courseEntries(): Promise<MetadataRoute.Sitemap> {
  try {
    const courses = (await CourseRepository.fromEnv()?.activeSlugs()) ?? [];
    return courses.map(({ slug, updatedAt }) => ({
      url: `${siteConfig.url}/courses/${slug}`,
      lastModified: updatedAt,
      changeFrequency: "weekly",
      priority: 0.9,
    }));
  } catch (error) {
    console.error("sitemap: could not load courses", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority }) => ({
    url: `${siteConfig.url}${path}`,
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority,
  }));
  const articles: MetadataRoute.Sitemap = new JournalCatalog().all().map((article) => ({
    url: `${siteConfig.url}/journal/${article.slug}`,
    lastModified: new Date(`${article.publishedAt}T00:00:00Z`),
    changeFrequency: "yearly",
    priority: 0.6,
  }));
  return [...pages, ...articles, ...(await courseEntries())];
}
