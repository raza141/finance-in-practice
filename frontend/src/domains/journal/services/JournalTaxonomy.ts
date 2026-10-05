/**
 * Fixed vocabularies for research articles. Keep in sync with the CHECK
 * constraints of 009_articles in scripts/db/migrate.mts; adding a value needs
 * a migration. Tags are free text and need neither.
 */
export class JournalTaxonomy {
  static readonly CATEGORIES = [
    "CFA Curriculum",
    "FRM & Risk Management",
    "Quantitative Finance",
    "Portfolio Management",
    "Valuation & Financial Modeling",
    "Python & Financial Data",
    "Markets: Pakistan, UAE & Global",
  ] as const;

  static readonly AUDIENCES = [
    "CFA Level I",
    "CFA Level II",
    "FRM Part I",
    "FRM Part II",
    "University Finance",
    "Analyst",
    "Portfolio Manager",
    "Risk Professional",
  ] as const;

  static readonly FORMATS = [
    "Explainer",
    "Worked Example",
    "Case Study",
    "Python Notebook",
    "Market Note",
    "Research Commentary",
    "Framework",
  ] as const;

  static readonly DIFFICULTIES = ["Foundation", "Intermediate", "Advanced"] as const;

  static readonly ROLES = [
    "takeaway",
    "context",
    "concept",
    "formula",
    "data",
    "steps",
    "example",
    "chart",
    "code",
    "interpretation",
    "pitfalls",
    "limitations",
    "outlook",
  ] as const;

  static isCategory(value: unknown): value is Category {
    return (JournalTaxonomy.CATEGORIES as readonly unknown[]).includes(value);
  }

  static isAudience(value: unknown): value is Audience {
    return (JournalTaxonomy.AUDIENCES as readonly unknown[]).includes(value);
  }

  static isFormat(value: unknown): value is ArticleFormat {
    return (JournalTaxonomy.FORMATS as readonly unknown[]).includes(value);
  }

  static isDifficulty(value: unknown): value is Difficulty {
    return (JournalTaxonomy.DIFFICULTIES as readonly unknown[]).includes(value);
  }

  static isRole(value: unknown): value is FrameworkRole {
    return (JournalTaxonomy.ROLES as readonly unknown[]).includes(value);
  }

  /** "Markets: Pakistan, UAE & Global" -> "markets-pakistan-uae-global", for filter URLs. */
  static param(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  static fromParam<T extends string>(values: readonly T[], param: string | undefined): T | null {
    return values.find((v) => JournalTaxonomy.param(v) === param) ?? null;
  }
}

export type Category = (typeof JournalTaxonomy.CATEGORIES)[number];
export type Audience = (typeof JournalTaxonomy.AUDIENCES)[number];
export type ArticleFormat = (typeof JournalTaxonomy.FORMATS)[number];
export type Difficulty = (typeof JournalTaxonomy.DIFFICULTIES)[number];
export type FrameworkRole = (typeof JournalTaxonomy.ROLES)[number];
