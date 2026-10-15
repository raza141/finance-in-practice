import type { MetadataRoute } from "next";

import { siteConfig } from "@/core/config/site";

/** "Add to home screen": the installed app opens straight on the student portal. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} · Student portal`,
    short_name: "FIP Portal",
    description: "Your sessions, class to-do, marks and study plan.",
    start_url: siteConfig.studentBooking.href,
    scope: "/",
    display: "standalone",
    background_color: "#0B1120",
    theme_color: "#0B1120",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
