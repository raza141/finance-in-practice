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
    "1-on-1 CFA® Level 1 & 2 and FRM® Part 1 tutoring, classes and coaching: at home in Abu Dhabi or live online across the UAE. Book a free diagnostic session.",

  /** The footer of every billing document and client email (name, address and phone come from Settings on documents). */
  letterhead: {
    motto: "Learn finance the way it is practiced.",
    courses: "CFA® Level I & II • FRM® • University Finance",
    address: "Abu Dhabi, UAE",
  },

  /** Where 1-on-1 sessions happen: at the learner's home in Abu Dhabi (base: Khalifa City), online everywhere else. */
  delivery: {
    line: "At your home anywhere in Abu Dhabi, or in Khalifa City · live online for Dubai and the rest of the UAE.",
    short: "At your home in Abu Dhabi · Online across the UAE",
    onsiteCity: "Abu Dhabi",
    onsiteArea: "Khalifa City",
  },

  /** Primary navigation. `children` (optional) render as a dropdown on desktop. */
  nav: [
    { label: "Home", href: "/" },
    { label: "Courses", href: "/courses" },
    { label: "Pricing", href: "/pricing" },
    { label: "Question Bank", href: "/cfa/questions" },
    { label: "Resources", href: "/resources" },
    { label: "Blog", href: "/journal" },
    { label: "Instructor", href: "/about" },
    { label: "Contact", href: "/contact" },
  ] as readonly NavItem[],

  /** Footer columns; Privacy and Terms sit in the bottom bar beside the copyright. */
  footerGroups: [
    {
      title: "Study",
      links: [
        { label: "Courses", href: "/courses" },
        { label: "Pricing", href: "/pricing" },
        { label: "Question Bank", href: "/cfa/questions" },
        { label: "Resources", href: "/resources" },
        { label: "Blog", href: "/journal" },
      ],
    },
    {
      title: "About",
      links: [
        { label: "Instructor", href: "/about" },
        { label: "Methodology", href: "/#methodology" },
        {
          label: "Review us on Google",
          href: "https://g.page/r/CXVZIOQD9qJXEBM/review",
        },
      ],
    },
    {
      title: "Contact",
      links: [
        { label: "Contact", href: "/contact" },
        { label: "Student login", href: "/student" },
      ],
    },
  ] as readonly { title: string; links: readonly NavItem[] }[],
  legalNav: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ] as readonly NavItem[],

  /** Gold conversion button at the end of the navbar. */
  navCta: { label: "Book free diagnostic", href: "/#book" },

  /** Public contact channels. Leave `email` null to hide it on /contact. */
  contact: {
    email: null as string | null,
    calUrl: "https://cal.com/raza141/30min",
    /** Google Business Profile: reviews are collected there, not on the site. */
    googleProfileUrl: "https://g.page/r/CXVZIOQD9qJXEBM",
    googleReviewUrl: "https://g.page/r/CXVZIOQD9qJXEBM/review",
    /** Places API ID of that profile (rating + reviews on the home page). Built from its Maps feature ID 0x8a8b6056f035e7fb:0x57a2f603e4205975. */
    googlePlaceId: "ChIJ--c18FZgi4oRdVkg5AP2olc",
    linkedinUrl: "https://www.linkedin.com/company/financeinpractice",
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

  /** Public fees, by the hour or by the month (flexible schedule, at home in Abu Dhabi or online). Exam course pages keep theirs in Admin → Courses. */
  fees: {
    exam: "AED 150 / hour · 12 hours AED 1,500 · 30 hours AED 3,000",
    university: "AED 125 / hour · AED 950 / 10 hours · AED 2,000 / month (20 hours)",
    personal: "AED 100 / hour",
  },

  /** Enrolled students sign in at /student and book this hidden Cal.com event (raza141/session). */
  /** `lengths` must be durations the Cal.com "session" event offers (it may offer more, e.g. 240; only these are bookable here). */
  /** `maxUpcoming`: a student's own upcoming sessions (pending included) before booking more is refused. */
  studentBooking: {
    eventSlug: "session",
    minutes: 60,
    lengths: [60, 120, 180],
    maxUpcoming: 4,
    href: "/student",
  },

  /** Classroom feed in the portal: mocks below this percentage get a "book a review" prompt (the owner's target, not an official pass mark). */
  classroom: { targetPct: 70 },

  /**
   * Authority metrics. Every figure must be verifiable: these describe the
   * in-house quant engine (see quant-backend/README.md). Add teaching metrics
   * (e.g. hours tutored) only once they are tracked.
   */
  metrics: [
    {
      value: 132,
      label: "Automated engine tests",
      detail: "incl. Hull & BKM benchmarks",
    },
    {
      value: 11,
      label: "Quant API endpoints",
      detail: "Pricing · risk · portfolio",
    },
    {
      value: 3,
      label: "VaR methodologies",
      detail: "Parametric · historical · Monte Carlo",
    },
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
    regulatory: "For educational purposes only. Finance in Practice does not provide financial, investment or regulated advisory services.",
    trademarks:
      "CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. FRM® and Financial Risk Manager® are registered trademarks of the Global Association of Risk Professionals (GARP). CFA Institute and GARP do not endorse, promote or warrant the accuracy or quality of the services offered here.",
  },
} as const;

export type SiteConfig = typeof siteConfig;
