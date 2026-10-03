import type { MetadataRoute } from "next";

import { siteConfig } from "@/core/config/site";

const PRIVATE = ["/admin", "/api/"];

/** AI crawlers named explicitly so a blanket rule elsewhere can never shut them out. */
const AI_BOTS = ["GPTBot", "Google-Extended", "anthropic-ai", "ClaudeBot", "CCBot", "PerplexityBot"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: AI_BOTS, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
