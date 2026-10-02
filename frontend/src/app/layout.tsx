import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Merriweather } from "next/font/google";
import Script from "next/script";

import { Footer } from "@/core/components/layout/Footer";
import { Navbar } from "@/core/components/layout/Navbar";
import { CustomCursor } from "@/core/components/ui/CustomCursor";
import { siteConfig } from "@/core/config/site";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
});

const merriweather = Merriweather({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-merriweather",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} | CFA®, FRM® & Quant Finance Tutoring`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    url: siteConfig.url,
    title: siteConfig.tagline,
    description: siteConfig.description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.tagline,
    description: siteConfig.description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1120",
  colorScheme: "dark",
};

/**
 * Runs before first paint on "/": hides [data-anim] elements so the
 * LandingAnimationController can reveal them without a flash. Skipped for
 * reduced-motion users and every other route.
 */
const ANIMATION_PREPAINT = `(function(){try{if(location.pathname==="/"&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.classList.add("anim-ready")}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${merriweather.variable} ${jetbrainsMono.variable}`}
      // Next 16 no longer neutralises CSS smooth scrolling on route changes;
      // this attribute restores instant scroll-to-top between pages.
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col pointer-fine:cursor-none">
        <Script id="animation-prepaint" strategy="beforeInteractive">
          {ANIMATION_PREPAINT}
        </Script>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded focus:bg-surface focus:px-4 focus:py-2"
        >
          Skip to content
        </a>
        <Navbar />
        {/* pt clears the fixed floating navbar */}
        <main id="main" className="flex-1 pt-20">
          {children}
        </main>
        <Footer />
        <CustomCursor />
      </body>
    </html>
  );
}
