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
  tagline: "1-on-1 CFA® & FRM® tutoring in Abu Dhabi and online across the UAE.",
  description:
    "1-on-1 CFA® Level I, FRM® and finance tutoring: in person in Abu Dhabi, live online for Dubai and across the UAE. Book a free diagnostic session.",

  /** Where 1-on-1 sessions happen: at the learner's home in Abu Dhabi (base: Khalifa City), online everywhere else. */
  delivery: {
    line: "At your home anywhere in Abu Dhabi, or in Khalifa City · live online for Dubai and the rest of the UAE.",
    short: "At your home in Abu Dhabi · Online across the UAE",
    onsiteCity: "Abu Dhabi",
    onsiteArea: "Khalifa City",
  },

  /** Primary navigation. `children` (optional) render as a dropdown on desktop. */
  nav: [
    { label: "Terminal", href: "/" },
    { label: "Instructor", href: "/about" },
    { label: "Learning Tracks", href: "/courses" },
    { label: "Research Terminal", href: "/journal" },
    { label: "Resources", href: "/resources" },
    { label: "Contact", href: "/contact" },
  ] as readonly NavItem[],

  // ponytail: add Privacy and Terms here once those pages exist.
  footerNav: [
    { label: "Terminal", href: "/" },
    { label: "Learning Tracks", href: "/courses" },
    { label: "Methodology", href: "/#methodology" },
    { label: "Instructor", href: "/about" },
    { label: "Research Terminal", href: "/journal" },
    { label: "Resources", href: "/resources" },
    { label: "Contact", href: "/contact" },
    { label: "Share your experience", href: "/testimonials/submit" },
  ] as readonly NavItem[],

  /** Gold conversion button at the end of the navbar. */
  navCta: { label: "Book free diagnostic", href: "/#book" },

  /** Public contact channels. Leave `email` null to hide it on /contact. */
  contact: {
    email: null as string | null,
    calUrl: "https://cal.com/raza141/30min",
    /** Click-to-chat number in international format, digits only (wa.me). */
    whatsapp: {
      number: "971588070565",
      display: "+971 58 807 0565",
      /** Person who answers this number, shown on /contact. */
      owner: "Muhammad Ahmed Raza",
      greeting: "Hi Finance in Practice! I'd like to know more about your courses.",
    },
  },

  bookingHref: "/#book",

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
      "For educational purposes only. Finance in Practice does not provide financial, investment or regulated advisory services.",
    trademarks:
      "CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. FRM® and Financial Risk Manager® are registered trademarks of the Global Association of Risk Professionals (GARP). CFA Institute and GARP do not endorse, promote or warrant the accuracy or quality of the services offered here.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
