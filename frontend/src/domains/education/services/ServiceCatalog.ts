export type BentoVisual = "code" | "stress" | "curve" | "none";

export interface BentoService {
  /** Also the in-page anchor used by the navbar, e.g. "#stress-testing". */
  id: string;
  kicker: string;
  title: string;
  summary: string;
  tags: readonly string[];
  /** Column span on the 12-column grid at lg+. */
  span: 4 | 8 | 12;
  visual: BentoVisual;
  waitlist?: boolean;
}

/** Equity shocks from the quant backend's preset stress scenarios (engines/risk/stress.py). */
export const STRESS_PREVIEW = [
  { label: "GFC 2008", shock: -0.5 },
  { label: "COVID 2020", shock: -0.34 },
  { label: "Stagflation", shock: -0.25 },
  { label: "+200bp", shock: -0.1 },
] as const;

/** Specialist tracks on /courses, after the exam course pages (which replace a combined CFA/FRM card). */
export class ServiceCatalog {
  private static readonly SERVICES: readonly BentoService[] = [
    {
      id: "university",
      kicker: "01 · Mentorship",
      title: "University finance",
      summary:
        "1-on-1 support for corporate finance, investments and econometrics coursework, dissertations and interviews.",
      tags: ["Coursework", "Dissertations"],
      span: 4,
      visual: "none",
    },
    {
      id: "automation",
      kicker: "02 · Automation",
      title: "Financial automation",
      summary:
        "Replace fragile spreadsheets with tested Python pipelines: data cleaning, reporting and analytics you can rerun in seconds.",
      tags: ["Python", "pandas", "NumPy"],
      span: 4,
      visual: "code",
    },
    {
      id: "stress-testing",
      kicker: "03 · Risk",
      title: "Stress testing & VaR",
      summary:
        "Parametric, historical and Monte Carlo VaR plus scenario stress tests, built and explained end to end.",
      tags: ["VaR", "Expected shortfall", "Scenarios"],
      span: 4,
      visual: "stress",
    },
    {
      id: "financial-modeling",
      kicker: "04 · Modeling",
      title: "Financial modeling",
      summary:
        "Valuation, bond and option pricing models built step by step, with outputs checked against textbook benchmarks.",
      tags: ["Valuation", "Fixed income", "Options"],
      span: 4,
      visual: "curve",
    },
    {
      id: "portfolio-ml",
      kicker: "05 · Portfolio",
      title: "Portfolio construction & optimization with ML",
      summary:
        "From mean-variance to machine-learning signals: covariance shrinkage, hierarchical risk parity and return forecasting, backtested in Python.",
      tags: ["Mean-variance", "HRP", "Machine learning"],
      span: 4,
      visual: "none",
    },
    {
      id: "ips-cme",
      kicker: "06 · Planning",
      title: "IPS & capital market expectations",
      summary:
        "Draft an Investment Policy Statement and build the capital market expectations behind it, from return objectives and constraints to asset-class forecasts.",
      tags: ["IPS", "CME", "Asset allocation"],
      span: 4,
      visual: "none",
    },
    {
      id: "goal-based-wealth",
      kicker: "07 · Wealth",
      title: "Goal-based wealth management (UHNI)",
      summary:
        "Structure ultra-high-net-worth portfolios around client goals: liability mapping, goal-based buckets and multi-generational planning.",
      tags: ["UHNI", "Goals-based", "Private wealth"],
      span: 4,
      visual: "none",
    },
    {
      id: "lms",
      kicker: "08 · Coming soon",
      title: "On-demand learning platform",
      summary:
        "Self-paced courses with interactive quant labs running on the same engine as the 1-on-1 sessions.",
      tags: ["Self-paced", "Quant labs"],
      span: 8,
      visual: "none",
      waitlist: true,
    },
  ];

  all(): readonly BentoService[] {
    return ServiceCatalog.SERVICES;
  }
}
