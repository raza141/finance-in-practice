export interface NavItem {
  label: string;
  href: string;
  children?: readonly NavItem[];
}

/** Site-wide brand facts. Edit here; components read from this single source. */
export const siteConfig = {
  name: "Finance in Practice",
  domain: "financeinpractice.me",
  url: "https://financeinpractice.me",
  tagline: "Master Financial Theory. Build Real-World Systems.",
  description:
    "CFA®, FRM® and university finance tutoring from a practitioner who builds the models in Python. Book a free 1-on-1 demo.",

  /** Primary navigation. `children` render as a dropdown on desktop. */
  nav: [
    { label: "About", href: "/about" },
    {
      label: "Courses",
      href: "/#curriculum",
      children: [
        { label: "Stress Testing", href: "/#stress-testing" },
        { label: "Financial Modeling", href: "/#financial-modeling" },
        { label: "Automation", href: "/#automation" },
      ],
    },
    { label: "Journal", href: "/journal" },
    { label: "Free Cohort", href: "/cohort" },
    { label: "Contact", href: "/contact" },
  ] satisfies readonly NavItem[],

  /** Gold conversion button at the end of the navbar. */
  navCta: { label: "Book free demo", href: "/consulting#book" },

  /** Public contact channels. Leave `email` null to hide it on /contact. */
  contact: {
    email: null as string | null,
    calUrl: "https://cal.com/raza141/30min",
    /** Click-to-chat number in international format, digits only (wa.me). */
    whatsapp: {
      number: "971581633864",
      greeting: "Hi Finance in Practice! I'd like to know more about your courses.",
    },
  },

  bookingHref: "/#book",

  credentials: ["CFA Level III Candidate", "FRM Part I Passed", "MSc Data Science"],

  /**
   * Authority metrics. Every figure must be verifiable: these describe the
   * in-house quant engine (see quant-backend/README.md). Add teaching metrics
   * (e.g. hours tutored) only once they are tracked.
   */
  metrics: [
    { value: 132, label: "Automated engine tests", detail: "incl. Hull & BKM benchmarks" },
    { value: 11, label: "Quant API endpoints", detail: "Pricing · risk · portfolio" },
    { value: 3, label: "VaR methodologies", detail: "Parametric · historical · Monte Carlo" },
    {
      // Measured 0.30-0.41s (2026-10-02) for 100 points, 50 assets, long-only.
      value: 0.5,
      decimals: 1,
      prefix: "<",
      suffix: "s",
      label: "100-point efficient frontier",
      detail: "50 assets, long-only QP",
    },
  ],

  disclosures: {
    regulatory:
      "Educational purposes only. Not registered investment advice under SECP or international regulators.",
    trademarks:
      "CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. FRM® and Financial Risk Manager® are registered trademarks of the Global Association of Risk Professionals (GARP). CFA Institute and GARP do not endorse, promote or warrant the accuracy or quality of the services offered here.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
