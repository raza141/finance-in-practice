/**
 * The recommended service catalogue, as a reviewed, repeatable import. No
 * prices: rates are set per service in /admin/services.
 *
 *   node --env-file-if-exists=.env.local scripts/db/service-seeds.mts --apply   # runs it on DATABASE_URL
 *   node scripts/db/service-seeds.mts                                           # prints the SQL (for the Vercel query editor)
 *
 * New services arrive archived, so nothing is offered until you reactivate it.
 * An existing code is never touched: it is reported as already there, or as a
 * conflict when it names a different service. Re-running adds nothing twice.
 */
import { neon } from "@neondatabase/serverless";

type Unit = "hour" | "month" | "session" | "package" | "fee" | "milestone";

export interface ServiceSeed {
  code: string;
  name: string;
  category: string;
  description: string;
  units: Unit[];
  /** null = "Choose on each line". */
  defaultUnit: Unit | null;
}

const EXAM: Pick<ServiceSeed, "units" | "defaultUnit"> = { units: ["hour", "month", "session", "package"], defaultUnit: null };
const TUTORING: Pick<ServiceSeed, "units" | "defaultUnit"> = { units: ["hour", "session", "package"], defaultUnit: "hour" };
const GUIDANCE: Pick<ServiceSeed, "units" | "defaultUnit"> = { units: ["hour", "session", "fee"], defaultUnit: null };
const RETAINER: Pick<ServiceSeed, "units" | "defaultUnit"> = { units: ["hour", "month", "fee", "milestone"], defaultUnit: null };
const PROJECT: Pick<ServiceSeed, "units" | "defaultUnit"> = { units: ["hour", "fee", "milestone"], defaultUnit: "fee" };

export const SERVICE_SEEDS: readonly ServiceSeed[] = [
  { code: "CF001", name: "CFA Level I Coaching", category: "CFA", ...EXAM,
    description: "Personalised coaching covering financial concepts, guided question practice, revision, and exam preparation for CFA Level I." },
  { code: "CF002", name: "CFA Level II Coaching", category: "CFA", ...EXAM,
    description: "Personalised coaching covering valuation, analytical application, item-set practice, and exam preparation for CFA Level II." },
  { code: "FR001", name: "FRM Part I Coaching", category: "FRM", ...EXAM,
    description: "Personalised coaching covering quantitative methods, financial markets, valuation, risk concepts, and exam preparation for FRM Part I." },
  { code: "UF001", name: "University Finance Tutoring", category: "University", ...TUTORING,
    description: "Academic tutoring in finance, including concept explanation, numerical problem-solving, and examination preparation." },
  { code: "UF002", name: "University Accounting Tutoring", category: "University", ...TUTORING,
    description: "Academic tutoring in financial accounting, financial statements, and accounting problem-solving." },
  { code: "UF003", name: "Quantitative Methods Tutoring", category: "University", ...TUTORING,
    description: "Guided learning in statistics, financial mathematics, and quantitative techniques for academic or professional study." },
  { code: "AS001", name: "Assignment Guidance and Review", category: "Academic Support", ...GUIDANCE,
    description: "Guidance on assignment structure, financial reasoning, calculations, and referencing, with feedback on the student's own work." },
  { code: "AS002", name: "Research Project Coaching", category: "Academic Support", ...GUIDANCE,
    description: "Coaching on research questions, methodology, financial analysis, and presentation of student-led research." },
  { code: "BC001", name: "Business Consultancy", category: "Business Consultancy", ...RETAINER,
    description: "Consultancy on business planning, operating performance, commercial decisions, and agreed business objectives." },
  { code: "BC002", name: "Business Plan Development", category: "Business Consultancy", ...PROJECT,
    description: "Development or review of a business plan covering the business model, market assumptions, operating strategy, and financial projections." },
  { code: "FC001", name: "Financial Analysis Consultancy", category: "Financial Consultancy", ...RETAINER,
    description: "Analysis of financial statements, profitability, liquidity, cash flows, and financial performance against an agreed scope." },
  { code: "FC002", name: "Financial Modelling and Forecasting", category: "Financial Consultancy", ...PROJECT,
    description: "Development or review of financial models, forecasts, scenario analysis, and decision-support calculations." },
  { code: "FC003", name: "Business Valuation Analysis", category: "Financial Consultancy", ...PROJECT,
    description: "Business valuation analysis using agreed methods, financial assumptions, and supporting sensitivity analysis." },
  { code: "FC004", name: "Budgeting and Cash-Flow Planning", category: "Financial Consultancy", ...PROJECT,
    description: "Preparation or review of budgets, cash-flow forecasts, funding requirements, and financial planning scenarios." },
  { code: "WS001", name: "Finance Training Workshop", category: "Training", units: ["session", "fee"], defaultUnit: "fee",
    description: "Delivery of a tailored finance workshop covering agreed topics, practical examples, and participant exercises." },
];

const quote = (text: string) => `'${text.replaceAll("'", "''")}'`;

/** One statement: inserts missing codes (archived) and returns what happened to each. */
export function serviceSeedStatement(seeds: readonly ServiceSeed[] = SERVICE_SEEDS): string {
  const rows = seeds.map(
    (s) =>
      `(${quote(s.code)}, ${quote(s.name)}, ${quote(s.category)}, ${quote(s.description)}, ARRAY[${s.units.map(quote).join(", ")}]::text[], ${s.defaultUnit ? quote(s.defaultUnit) : "NULL"}::text)`,
  );
  return [
    `WITH v (code, name, category, description, units, default_unit) AS (VALUES ${rows.join(", ")}),`,
    `ins AS (INSERT INTO services (code, name, description, category, units, default_unit, archived_at)`,
    `SELECT code, name, description, category, units, default_unit, now() FROM v ON CONFLICT (code) DO NOTHING RETURNING code)`,
    `SELECT v.code, CASE WHEN ins.code IS NOT NULL THEN 'added (archived until you reactivate it)'`,
    `WHEN s.name = v.name THEN 'already in the catalogue: left as is'`,
    `ELSE 'code conflict: ' || v.code || ' is already "' || s.name || '": left as is' END AS result`,
    `FROM v LEFT JOIN ins ON ins.code = v.code LEFT JOIN services s ON s.code = v.code ORDER BY v.code;`,
  ].join(" ");
}

if (process.argv[1]?.endsWith("service-seeds.mts")) {
  if (!process.argv.includes("--apply")) {
    console.log(serviceSeedStatement());
  } else {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const rows = (await neon(url).query(serviceSeedStatement())) as { code: string; result: string }[];
    for (const row of rows) console.log(`${row.code}  ${row.result}`);
  }
}
