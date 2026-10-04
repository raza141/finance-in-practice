import type { MetadataRoute } from "next";

import { siteConfig } from "@/core/config/site";
import { CourseRepository } from "@/domains/courses/server/CourseRepository";
import { JournalCatalog } from "@/domains/journal/services/JournalCatalog";

// Cached like a page and refreshed hourly; course saves in admin also revalidate it.
export const revalidate = 3600;

// No lastModified on hand-written pages: a date that always reads "now" teaches
// crawlers to ignore it. Articles and courses carry their real dates below.
const STATIC_ROUTES: { path: string; priority: number; changeFrequency: "daily" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "daily" }, // Market Pulse card refreshes each trading day
  { path: "/courses", priority: 0.9, changeFrequency: "monthly" },
  { path: "/consulting", priority: 0.8, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/cohort", priority: 0.5, changeFrequency: "monthly" },
  { path: "/journal", priority: 0.5, changeFrequency: "monthly" },
  { path: "/testimonials/submit", priority: 0.3, changeFrequency: "monthly" },
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
  const pages: MetadataRoute.Sitemap = STATIC_ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: `${siteConfig.url}${path}`,
    changeFrequency,
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
