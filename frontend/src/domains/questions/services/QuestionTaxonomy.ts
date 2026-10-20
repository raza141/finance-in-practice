import type { Difficulty } from "../types";

export interface QuestionTopic {
  slug: string;
  name: string;
  /** Short code in the internal id: FIP-CFA-L1-FI-001. */
  code: string;
}

/** The CFA Program's ten topic areas (Levels I and II share them), in curriculum order. */
export class QuestionTaxonomy {
  static readonly TOPICS: readonly QuestionTopic[] = [
    { slug: "ethics", name: "Ethical and Professional Standards", code: "ETH" },
    { slug: "quantitative-methods", name: "Quantitative Methods", code: "QM" },
    { slug: "economics", name: "Economics", code: "ECON" },
    {
      slug: "financial-statement-analysis",
      name: "Financial Statement Analysis",
      code: "FSA",
    },
    { slug: "corporate-issuers", name: "Corporate Issuers", code: "CI" },
    { slug: "equity", name: "Equity Investments", code: "EQ" },
    { slug: "fixed-income", name: "Fixed Income", code: "FI" },
    { slug: "derivatives", name: "Derivatives", code: "DER" },
    {
      slug: "alternative-investments",
      name: "Alternative Investments",
      code: "ALT",
    },
    { slug: "portfolio-management", name: "Portfolio Management", code: "PM" },
  ];

  static readonly DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

  static readonly LEVELS: readonly (1 | 2 | 3)[] = [1, 2, 3];

  /** What a difficulty means to a candidate; shown next to the badge and in the bank's filter. */
  static readonly DIFFICULTY_HINTS: Record<Difficulty, string> = {
    easy: "One concept, one step",
    medium: "Two or three steps",
    hard: "Several steps or a common exam trap",
  };

  static topic(slug: string): QuestionTopic | undefined {
    return QuestionTaxonomy.TOPICS.find((t) => t.slug === slug);
  }

  static levelLabel(level: number): string {
    return `CFA Level ${"I".repeat(level)}`;
  }

  static difficultyLabel(d: Difficulty): string {
    return d[0].toUpperCase() + d.slice(1);
  }

  static difficultyHint(d: Difficulty): string {
    return QuestionTaxonomy.DIFFICULTY_HINTS[d];
  }

  static letter(index: number): string {
    return String.fromCharCode(65 + index);
  }

  static path(q: { topic: string; slug: string }): string {
    return `/cfa/questions/${q.topic}/${q.slug}`;
  }
}
