/**
 * Sample courses for 016–020. Inserted as drafts: an owner reviews and
 * publishes them from /admin/courses. Fees are left "on request" on purpose;
 * set real ones in the editor.
 */

interface CourseSeed {
  slug: string;
  title: string;
  category: string;
  eyebrow: string;
  summary: string;
  audience: string;
  notFor: string;
  difference: string;
  disclaimer: string;
  ctaLabel: string;
  coachingLabel: string;
  practiceLabel: string;
  duration: string;
  testimonialTicker: string | null;
  seoTitle: string;
  seoDescription: string;
  method: { title: string; description: string }[];
  modules: { title: string; priority: string; summary: string; coaching: string; practice: string; deliverable?: string }[];
  options: { title: string; description: string; fee: string }[];
  faqs: { question: string; answer: string }[];
}

const CFA_DISCLAIMER =
  "CFA® and Chartered Financial Analyst® are registered trademarks owned by CFA Institute. CFA Institute does not endorse, promote or warrant the accuracy or quality of the services offered by Finance in Practice.";

/** The original exam method, as seeded by 016–018. 021 replaces it with EXAM_METHOD_V2. */
const EXAM_METHOD = [
  {
    title: "Prepare",
    description: "You study the relevant official curriculum reading and attempt the assigned practice problems before we meet.",
  },
  {
    title: "Solve and diagnose",
    description:
      "We work through your attempted questions. You explain your thinking; we find whether the issue is a concept, formula, interpretation, calculation, or timing.",
  },
  {
    title: "Apply",
    description: "We connect the idea to a small real-world task: a spreadsheet, company report, bond-pricing exercise, or investor decision.",
  },
];

/** Four stages plus the ways to learn (021). */
const EXAM_METHOD_V2 = [
  { title: "Learn", description: "Understand the topic your way: on your own, with me teaching it live, or a mix of both." },
  {
    title: "Solve",
    description:
      "We work through official curriculum questions. You explain your thinking; we find whether the issue is concept, formula, interpretation, calculation or timing.",
  },
  {
    title: "Apply",
    description: "We connect the idea to a small real-world task: a spreadsheet, company report, bond-pricing exercise or investor decision.",
  },
  {
    title: "Revise",
    description: "Short, spaced recall brings topics back before they fade: quick quizzes, retried mistakes and mixed sets.",
  },
];

const EXAM_MODES = [
  { title: "Self-study", description: "You read the official curriculum first and bring your questions." },
  { title: "Study with me", description: "I teach the topic live, then we go straight into questions." },
  { title: "Guided", description: "You read first; I teach only the parts you found hard." },
];

const BUILD_METHOD = [
  { title: "Prepare", description: "You work through a short set of notes and an exercise before we meet." },
  {
    title: "Build and review",
    description: "We go through what you built line by line: what works, what breaks, and why. You fix it while we talk.",
  },
  { title: "Apply", description: "You extend the exercise to real data or a real company, so you leave with a working tool, not just notes." },
];

const EXAM_OPTIONS = [
  { title: "Free diagnostic", description: "30 minutes: where you are, a few attempted questions reviewed, and whether coaching fits.", fee: "Free" },
  { title: "Topic coaching", description: "Single sessions on the topics you find hardest, booked as you need them.", fee: "On request" },
  { title: "Full programme", description: "A session plan across the whole curriculum up to exam day.", fee: "On request" },
];

const BUILD_OPTIONS = [
  { title: "Free consultation", description: "30 minutes to agree your goal, your starting point and a plan.", fee: "Free" },
  { title: "Per session", description: "One-to-one sessions booked as you need them.", fee: "On request" },
  { title: "Full course", description: "Every module in order, with a finished project at the end.", fee: "On request" },
];

const EXAM_FAQS = (exam: string, body: string) => [
  {
    question: "Do I need the official curriculum?",
    answer: `Yes. Sessions work from the official ${body} curriculum and practice problems you have access to as a registered ${exam} candidate.`,
  },
  {
    question: "Is this a lecture course?",
    answer: "No. You read and attempt the problems first; sessions are spent on your attempts, your mistakes and how to fix them.",
  },
  {
    question: "Do you guarantee a pass?",
    answer: "No one honestly can. What you get is a clear picture of your weak areas and a plan to close them before exam day.",
  },
  {
    question: "What happens in the free diagnostic?",
    answer: "We look at where you are in the curriculum, review a few questions you have attempted, and agree whether coaching is a good fit.",
  },
];

export const COURSE_SEEDS: CourseSeed[] = [
  {
    slug: "cfa-level-1",
    title: "CFA Level I",
    category: "CFA",
    eyebrow: "Exam coaching",
    summary:
      "One-to-one coaching for candidates who want to understand the official curriculum, solve their own difficult questions with confidence, and use finance beyond the exam.",
    audience:
      "For serious CFA Level I candidates who are willing to attempt the reading and official practice problems before each session.",
    notFor: "It is not a passive lecture course or a shortcut to a pass.",
    difference: "Not another lecture series.\nBring your attempt. Leave knowing exactly what went wrong and what to do next.",
    disclaimer: CFA_DISCLAIMER,
    ctaLabel: "Book a free diagnostic",
    coachingLabel: "Official-question coaching",
    practiceLabel: "In practice",
    duration: "1-on-1 · flexible schedule",
    testimonialTicker: "CFA1",
    seoTitle: "CFA Level I coaching, one-to-one",
    seoDescription:
      "One-to-one CFA Level I coaching built on the official curriculum: solve your own difficult questions and apply each topic to a real task.",
    method: EXAM_METHOD,
    modules: [
      {
        title: "Quantitative Methods",
        priority: "foundation",
        summary: "Build the tools used across valuation, risk and portfolio decisions.",
        coaching: "Attempt your official curriculum practice problems; diagnose calculation, formula, and interpretation errors.",
        practice: "Build a return, risk, and compounding worksheet.",
      },
      {
        title: "Financial Statement Analysis",
        priority: "high_priority",
        summary: "Read financial statements as an investor, not as a checklist.",
        coaching: "Review the official curriculum questions you attempted and identify why each distractor looked plausible.",
        practice: "Analyse a listed company’s annual report and write a short investor note.",
      },
      {
        title: "Fixed Income",
        priority: "high_priority",
        summary: "Understand price, yield, duration, and interest-rate risk.",
        coaching: "Solve the official curriculum practice problems with a focus on the reasoning behind each step.",
        practice: "Price a bond in a spreadsheet and stress-test it for a rate move.",
      },
      {
        title: "Portfolio Management",
        priority: "core",
        summary: "Connect risk, return, diversification, and client objectives.",
        coaching: "Work through questions on portfolio risk and return, then revisit any weak logic.",
        practice: "Draft a simple Investment Policy Statement for a fictional client.",
      },
    ],
    options: EXAM_OPTIONS,
    faqs: EXAM_FAQS("CFA", "CFA Institute"),
  },
  {
    slug: "cfa-level-2",
    title: "CFA Level II",
    category: "CFA",
    eyebrow: "Exam coaching",
    summary:
      "One-to-one coaching for Level II candidates who need to apply the curriculum inside long item-set vignettes, not just recall it.",
    audience: "For CFA Level II candidates who attempt the official item sets before each session and want to know exactly why they miss marks.",
    notFor: "It is not a re-teach of Level I or a set of shortcuts that skip the reading.",
    difference: "Vignettes, not formulas.\nWe train you to find what the question is really asking inside a page of case text.",
    disclaimer: CFA_DISCLAIMER,
    ctaLabel: "Book a free diagnostic",
    coachingLabel: "Official-question coaching",
    practiceLabel: "In practice",
    duration: "1-on-1 · flexible schedule",
    testimonialTicker: "CFA2",
    seoTitle: "CFA Level II coaching, one-to-one",
    seoDescription:
      "One-to-one CFA Level II coaching on the official item sets: equity valuation, fixed income, FSA and derivatives applied to real cases.",
    method: EXAM_METHOD,
    modules: [
      {
        title: "Equity Valuation",
        priority: "high_priority",
        summary: "Choose and defend the right valuation model for the company in front of you.",
        coaching: "Work your attempted item sets and trace each answer back to the vignette detail that decides it.",
        practice: "Value a listed company with a two-stage dividend and free-cash-flow model.",
      },
      {
        title: "Financial Statement Analysis",
        priority: "high_priority",
        summary: "Adjust reported numbers for intercorporate investments, pensions and multinational operations.",
        coaching: "Review the official item sets you attempted and rebuild each adjustment step by step.",
        practice: "Restate a real company’s statements for one accounting choice and show the effect on ratios.",
      },
      {
        title: "Fixed Income",
        priority: "high_priority",
        summary: "Use term structure, binomial trees and credit models to value bonds.",
        coaching: "Solve the official practice problems with a focus on setting up each tree or curve correctly.",
        practice: "Build a small binomial interest-rate tree in a spreadsheet and value a callable bond.",
      },
      {
        title: "Derivatives",
        priority: "core",
        summary: "Price forwards, futures, swaps and options from no-arbitrage first principles.",
        coaching: "Work through your attempted questions and fix sign and timing errors in the cash flows.",
        practice: "Price an interest-rate swap from a real yield curve.",
      },
      {
        title: "Portfolio Management",
        priority: "core",
        summary: "Connect economics, multifactor models and risk measures to portfolio decisions.",
        coaching: "Review the official item sets on factor models and VaR, then revisit any weak logic.",
        practice: "Estimate a simple factor model on market data and interpret the exposures.",
      },
    ],
    options: EXAM_OPTIONS,
    faqs: EXAM_FAQS("CFA", "CFA Institute"),
  },
  {
    slug: "frm-part-1",
    title: "FRM Part I",
    category: "FRM",
    eyebrow: "Exam coaching",
    summary:
      "One-to-one coaching for FRM Part I candidates who want to understand the risk models behind the questions and solve them under time pressure.",
    audience: "For FRM Part I candidates who work through the assigned readings and practice questions before each session.",
    notFor: "It is not a passive lecture course or a question bank to memorise.",
    difference: "Understand the model, then the question.\nEvery formula is rebuilt from the risk problem it solves.",
    disclaimer:
      "GARP® does not endorse, promote, review or warrant the accuracy of the services offered by Finance in Practice, nor does it endorse any pass rates claimed by the provider. FRM® and Financial Risk Manager® are trademarks owned by the Global Association of Risk Professionals, Inc.",
    ctaLabel: "Book a free diagnostic",
    coachingLabel: "Practice-question coaching",
    practiceLabel: "In practice",
    duration: "1-on-1 · flexible schedule",
    testimonialTicker: "FRM1",
    seoTitle: "FRM Part I coaching, one-to-one",
    seoDescription:
      "One-to-one FRM Part I coaching: foundations of risk, quantitative analysis, markets and products, and valuation and risk models.",
    method: EXAM_METHOD,
    modules: [
      {
        title: "Foundations of Risk Management",
        priority: "foundation",
        summary: "Learn how firms identify, measure and govern risk, and where it has gone wrong.",
        coaching: "Work through your attempted practice questions and separate concept gaps from reading-the-question errors.",
        practice: "Write a one-page risk review of a well-known risk-management failure.",
      },
      {
        title: "Quantitative Analysis",
        priority: "high_priority",
        summary: "Probability, regression, volatility and simulation as the risk manager uses them.",
        coaching: "Solve the practice questions step by step and fix formula and calculator errors.",
        practice: "Estimate volatility from market data with EWMA in a spreadsheet.",
      },
      {
        title: "Financial Markets and Products",
        priority: "high_priority",
        summary: "How futures, options, swaps and their markets transfer and create risk.",
        coaching: "Review the questions you attempted and rebuild each payoff and hedge from scratch.",
        practice: "Design and size a futures hedge for a real portfolio.",
      },
      {
        title: "Valuation and Risk Models",
        priority: "high_priority",
        summary: "VaR, expected shortfall, bond and option valuation, and credit risk.",
        coaching: "Work through the practice questions on VaR and option Greeks, then revisit any weak logic.",
        practice: "Compute parametric and historical VaR for a small portfolio and compare them.",
      },
    ],
    options: EXAM_OPTIONS,
    faqs: EXAM_FAQS("FRM", "GARP"),
  },
  {
    slug: "python-for-finance",
    title: "Python for Finance",
    category: "Applied Finance",
    eyebrow: "Applied finance",
    summary:
      "One-to-one coaching that takes you from spreadsheets to Python: market data, returns and risk, pricing and backtests, built on real data.",
    audience: "For finance students and professionals who are comfortable with Excel and want to build analysis they can rerun, test and share.",
    notFor: "It is not a general software-engineering course or a trading-signal service.",
    difference: "You write the code.\nEvery session ends with something you built and can run again tomorrow.",
    disclaimer: "",
    ctaLabel: "Book a free consultation",
    coachingLabel: "Code review",
    practiceLabel: "Build",
    duration: "1-on-1 · flexible schedule",
    testimonialTicker: "QUANT",
    seoTitle: "Python for Finance, one-to-one coaching",
    seoDescription:
      "Learn Python for finance one-to-one: pandas, returns and risk, bond and option pricing, and backtesting on real market data.",
    method: BUILD_METHOD,
    modules: [
      {
        title: "Python and pandas for market data",
        priority: "foundation",
        summary: "Load, clean and reshape price data without fighting the tools.",
        coaching: "We review your notebook and replace loops and copy-paste with clean pandas.",
        practice: "Download prices for a set of stocks and build a tidy returns table.",
      },
      {
        title: "Returns, risk and portfolios",
        priority: "core",
        summary: "Compute returns, volatility, correlation and portfolio risk correctly.",
        coaching: "We check your maths against the textbook definitions and fix annualisation errors.",
        practice: "Build an efficient frontier for a small multi-asset portfolio.",
      },
      {
        title: "Pricing bonds and options",
        priority: "core",
        summary: "Turn pricing formulas into functions you can test.",
        coaching: "We test your functions against known textbook values and find where they diverge.",
        practice: "Write a bond pricer and a Black–Scholes pricer with Greeks.",
      },
      {
        title: "Backtesting a strategy",
        priority: "high_priority",
        summary: "Test an idea honestly, without look-ahead bias or overfitting.",
        coaching: "We review your backtest for the mistakes that make results look better than they are.",
        practice: "Backtest a simple momentum rule and report its risk-adjusted performance.",
        deliverable: "A documented backtest notebook you can extend.",
      },
      {
        title: "Risk reporting",
        priority: "high_priority",
        summary: "Measure and report portfolio risk the way a risk desk does.",
        coaching: "We review your VaR code and the assumptions behind each method.",
        practice: "Produce a one-page VaR and stress-test report for a portfolio.",
      },
    ],
    options: BUILD_OPTIONS,
    faqs: [
      { question: "Do I need to know Python already?", answer: "No. If you are comfortable with Excel formulas, we start from there." },
      { question: "What do I need installed?", answer: "A laptop and a free Python setup. We get it working together in the first session." },
      { question: "Will I get the code?", answer: "Yes. Everything you build is yours to keep and reuse." },
    ],
  },
  {
    slug: "financial-modeling",
    title: "Financial Modeling",
    category: "Applied Finance",
    eyebrow: "Applied finance",
    summary:
      "One-to-one coaching to build a linked three-statement model and a valuation you can defend, on a real company.",
    audience: "For students, analysts and founders who want to build financial models that hold up when someone checks them.",
    notFor: "It is not a template pack or a course in Excel shortcuts.",
    difference: "A model you can defend.\nEvery number traces back to an assumption you can explain.",
    disclaimer: "",
    ctaLabel: "Book a free consultation",
    coachingLabel: "Model review",
    practiceLabel: "Build",
    duration: "1-on-1 · flexible schedule",
    testimonialTicker: "QUANT",
    seoTitle: "Financial modeling, one-to-one coaching",
    seoDescription:
      "Build a three-statement model and a DCF valuation one-to-one, on a real company, with every assumption reviewed.",
    method: BUILD_METHOD,
    modules: [
      {
        title: "Three-statement model",
        priority: "foundation",
        summary: "Link the income statement, balance sheet and cash flow so the model balances.",
        coaching: "We review your links and find why the balance sheet does not balance.",
        practice: "Build the historical statements of a listed company from its annual report.",
      },
      {
        title: "Forecasting drivers",
        priority: "core",
        summary: "Forecast revenue and costs from drivers you can justify.",
        coaching: "We challenge each assumption against the company’s history and peers.",
        practice: "Forecast five years of the company’s statements from operating drivers.",
      },
      {
        title: "DCF valuation",
        priority: "high_priority",
        summary: "Turn the forecast into free cash flow, a discount rate and a value per share.",
        coaching: "We review your WACC and terminal value, the two places most valuations go wrong.",
        practice: "Value the company and compare the result with its market price.",
        deliverable: "A complete DCF model of a real company.",
      },
      {
        title: "Scenarios and sensitivities",
        priority: "core",
        summary: "Show how the value moves when the key assumptions change.",
        coaching: "We check that your scenarios change the drivers, not just the output.",
        practice: "Add base, bull and bear cases and a sensitivity table to the model.",
      },
      {
        title: "Presenting the model",
        priority: "core",
        summary: "Explain the model and its conclusion to someone who will question it.",
        coaching: "We rehearse the questions a reviewer or investor will ask.",
        practice: "Write a one-page investment summary from your model.",
      },
    ],
    options: BUILD_OPTIONS,
    faqs: [
      { question: "Which software do we use?", answer: "Excel or Google Sheets. The method carries over to any tool." },
      { question: "Can I model my own company?", answer: "Yes. For founders we can build the model on your own numbers instead of a listed company." },
      { question: "How long does it take?", answer: "It depends on your starting point; we agree a plan in the free consultation." },
    ],
  },
];

/** A single-line SQL literal (E-strings carry the newlines) so `db:migrate -- --print` keeps it intact. */
const q = (value: string | null) =>
  value === null ? "NULL" : `E'${value.replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n")}'`;
const json = (value: unknown) => `${q(JSON.stringify(value))}::jsonb`;

/** 021: the exam courses get the four-stage method and the ways to learn, unless their method was already edited. */
export function examMethodUpdateStatement(): string {
  return (
    `UPDATE courses SET method = ${json(EXAM_METHOD_V2)}, modes = ${json(EXAM_MODES)} ` +
    `WHERE slug IN ('cfa-level-1', 'cfa-level-2', 'frm-part-1') AND method = ${json(EXAM_METHOD)}`
  );
}

/** As seeded by 016. */
const CFA1_DIFFERENCE = COURSE_SEEDS.find((seed) => seed.slug === "cfa-level-1")!.difference;

/** 021: CFA Level I's difference text now opens with "Learn it your way", unless it was already edited. */
export function cfa1DifferenceUpdateStatement(): string {
  const next = "Not another lecture series.\nLearn it your way. Leave knowing exactly what went wrong and what to do next.";
  return `UPDATE courses SET difference = ${q(next)} WHERE slug = 'cfa-level-1' AND difference = ${q(CFA1_DIFFERENCE)}`;
}

/** One INSERT per course. */
export function courseSeedStatement(seed: CourseSeed): string {
  return (
    "INSERT INTO courses (slug, title, category, eyebrow, summary, audience, not_for, difference, disclaimer, cta_label, " +
    "coaching_label, practice_label, duration, testimonial_ticker, seo_title, seo_description, method, modules, options, faqs) " +
    `VALUES (${[
      seed.slug, seed.title, seed.category, seed.eyebrow, seed.summary, seed.audience, seed.notFor, seed.difference,
      seed.disclaimer, seed.ctaLabel, seed.coachingLabel, seed.practiceLabel, seed.duration, seed.testimonialTicker,
      seed.seoTitle, seed.seoDescription,
    ].map(q).join(", ")}, ${json(seed.method)}, ${json(seed.modules)}, ${json(seed.options)}, ${json(seed.faqs)}) ` +
    "ON CONFLICT (slug) DO NOTHING"
  );
}
