import type { Difficulty } from "../types";

export interface QuestionTopic {
  slug: string;
  name: string;
  /** Short code in the internal id: FIP-CFA-L1-FI-001. */
  code: string;
  exam: Exam;
}

export type Exam = "cfa" | "frm";
/** 1–3 are CFA Levels I–III; 4 is FRM Part I. ponytail: one number per sitting; FRM Part II would be 5. */
export type QuestionLevel = 1 | 2 | 3 | 4;

const FRM_PART_I = 4;

/** The CFA Program's ten topic areas (Levels I and II share them), then FRM Part I's four, in curriculum order. */
export class QuestionTaxonomy {
  static readonly TOPICS: readonly QuestionTopic[] = [
    { slug: "ethics", name: "Ethical and Professional Standards", code: "ETH", exam: "cfa" },
    { slug: "quantitative-methods", name: "Quantitative Methods", code: "QM", exam: "cfa" },
    { slug: "economics", name: "Economics", code: "ECON", exam: "cfa" },
    {
      slug: "financial-statement-analysis",
      name: "Financial Statement Analysis",
      code: "FSA",
      exam: "cfa",
    },
    { slug: "corporate-issuers", name: "Corporate Issuers", code: "CI", exam: "cfa" },
    { slug: "equity", name: "Equity Investments", code: "EQ", exam: "cfa" },
    { slug: "fixed-income", name: "Fixed Income", code: "FI", exam: "cfa" },
    { slug: "derivatives", name: "Derivatives", code: "DER", exam: "cfa" },
    {
      slug: "alternative-investments",
      name: "Alternative Investments",
      code: "ALT",
      exam: "cfa",
    },
    { slug: "portfolio-management", name: "Portfolio Management", code: "PM", exam: "cfa" },
    { slug: "foundations-of-risk-management", name: "Foundations of Risk Management", code: "FRM", exam: "frm" },
    { slug: "quantitative-analysis", name: "Quantitative Analysis", code: "QA", exam: "frm" },
    { slug: "financial-markets-and-products", name: "Financial Markets and Products", code: "FMP", exam: "frm" },
    { slug: "valuation-and-risk-models", name: "Valuation and Risk Models", code: "VRM", exam: "frm" },
  ];

  static readonly DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

  static readonly LEVELS: readonly QuestionLevel[] = [1, 2, 3, FRM_PART_I];

  /** What a difficulty means to a candidate; shown next to the badge and in the bank's filter. */
  static readonly DIFFICULTY_HINTS: Record<Difficulty, string> = {
    easy: "One concept, one step",
    medium: "Two or three steps",
    hard: "Several steps or a common exam trap",
  };

  static topic(slug: string): QuestionTopic | undefined {
    return QuestionTaxonomy.TOPICS.find((t) => t.slug === slug);
  }

  static examOf(level: number): Exam {
    return level === FRM_PART_I ? "frm" : "cfa";
  }

  /** The topics a level's questions can take. */
  static topicsFor(level: number): readonly QuestionTopic[] {
    const exam = QuestionTaxonomy.examOf(level);
    return QuestionTaxonomy.TOPICS.filter((t) => t.exam === exam);
  }

  static levelLabel(level: number): string {
    return level === FRM_PART_I ? "FRM Part I" : `CFA Level ${"I".repeat(level)}`;
  }

  /** The level filter's button text: I, II, III, FRM. */
  static levelShort(level: number): string {
    return level === FRM_PART_I ? "FRM" : "I".repeat(level);
  }

  /** "CFA" or "FRM", for copy that names the exam. */
  static examName(level: number): string {
    return QuestionTaxonomy.examOf(level).toUpperCase();
  }

  static difficultyLabel(d: Difficulty): string {
    return d[0].toUpperCase() + d.slice(1);
  }

  static difficultyHint(d: Difficulty): string {
    return QuestionTaxonomy.DIFFICULTY_HINTS[d];
  }

  /**
   * Seconds per question at real exam pace: Level I is 180 questions in 4h30, Level II
   * 88 questions in 4h24, FRM Part I 100 questions in 4h. Level III mixes essays and item sets, so it has no single pace.
   */
  static examPaceSeconds(level: number): number | null {
    return level === 1 ? 90 : level === 2 ? 180 : level === FRM_PART_I ? 144 : null;
  }

  /** "FIP-CFA-L1-FI-", "FIP-FRM-P1-VRM-". */
  static codePrefix(q: { level: number; topic: string }): string {
    const sitting = QuestionTaxonomy.examOf(q.level) === "frm" ? "P1" : `L${q.level}`;
    return `FIP-${QuestionTaxonomy.examName(q.level)}-${sitting}-${QuestionTaxonomy.topic(q.topic)?.code ?? "GEN"}-`;
  }

  static letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  static path(q: { topic: string; slug: string }): string {
    return `/cfa/questions/${q.topic}/${q.slug}`;
  }
}
