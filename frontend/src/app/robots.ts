import type { MetadataRoute } from "next";

import { siteConfig } from "@/core/config/site";

const PRIVATE = ["/admin", "/api/"];

/** AI crawlers named explicitly so a blanket rule elsewhere can never shut them out. */
const AI_BOTS = [
  // training crawlers
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  // AI search indexes and on-demand fetches when a user asks about the site
  "OAI-SearchBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
