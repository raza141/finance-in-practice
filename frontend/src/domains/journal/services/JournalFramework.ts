import type { ArticleDocument, ArticleFormat, Block, BlockType, CalloutTone, FrameworkRole } from "../types";
import { BlockFactory } from "./BlockFactory";

export interface FrameworkSection {
  role: FrameworkRole;
  label: string;
  type: BlockType;
  required: boolean;
  hint: string;
  tone?: CalloutTone;
}

export interface SectionStatus extends FrameworkSection {
  state: "done" | "empty" | "missing";
  blockId: string | null;
}

const TAKEAWAY: FrameworkSection = {
  role: "takeaway",
  label: "Executive takeaway",
  type: "takeaway",
  required: true,
  hint: "Two to four lines a busy reader could stop after. Also seeds the excerpt and LinkedIn hook.",
};

/**
 * The house structure for each format: every research note follows the same
 * disciplined order. A new draft is seeded with these sections, and the
 * editor's checklist and the publish validator both read from here.
 */
export class JournalFramework {
  private static readonly SECTIONS: Readonly<Record<ArticleFormat, readonly FrameworkSection[]>> = {
    Explainer: [
      TAKEAWAY,
      { role: "context", label: "Why it matters", type: "text", required: true, hint: "Where this shows up: exam, desk, model." },
      { role: "concept", label: "Core concept", type: "text", required: true, hint: "The idea in plain language before any maths." },
      { role: "formula", label: "Formula", type: "formula", required: true, hint: "The formula, then what every symbol means." },
      { role: "example", label: "Worked example", type: "text", required: true, hint: "Real numbers, step by step." },
      { role: "chart", label: "Chart", type: "chart", required: false, hint: "Optional: show the idea with data." },
      { role: "pitfalls", label: "Exam traps & common mistakes", type: "callout", tone: "exam-trap", required: true, hint: "Where candidates and analysts slip." },
      { role: "limitations", label: "Limitations", type: "text", required: true, hint: "When the concept breaks down." },
    ],
    "Worked Example": [
      TAKEAWAY,
      { role: "context", label: "The problem", type: "text", required: true, hint: "State the question exactly as it would be asked." },
      { role: "data", label: "Given data", type: "table", required: true, hint: "Every input in one table." },
      { role: "formula", label: "Formula", type: "formula", required: true, hint: "The formula(s) used." },
      { role: "steps", label: "Step-by-step solution", type: "text", required: true, hint: "Numbered steps, one calculation each." },
      { role: "code", label: "Check it in Python", type: "code", required: false, hint: "Optional: reproduce the answer in code." },
      { role: "interpretation", label: "Interpretation", type: "text", required: true, hint: "What the number means and what to do with it." },
      { role: "pitfalls", label: "Exam traps", type: "callout", tone: "exam-trap", required: false, hint: "Optional: the usual wrong answers." },
    ],
    "Case Study": [
      TAKEAWAY,
      { role: "context", label: "Background", type: "text", required: true, hint: "Company, market, period, the decision at stake." },
      { role: "data", label: "The numbers", type: "table", required: false, hint: "Optional: the key figures." },
      { role: "concept", label: "Analysis", type: "text", required: true, hint: "Apply the framework to the facts." },
      { role: "interpretation", label: "Decision & outcome", type: "text", required: true, hint: "What was decided and what happened." },
      { role: "pitfalls", label: "Lessons", type: "callout", tone: "key-insight", required: true, hint: "What a practitioner should take away." },
      { role: "limitations", label: "Limitations", type: "text", required: true, hint: "What the case can't tell us." },
    ],
    "Python Notebook": [
      TAKEAWAY,
      { role: "context", label: "Objective", type: "text", required: true, hint: "What the notebook computes and why." },
      { role: "data", label: "Data & source", type: "text", required: true, hint: "Where the data comes from, period, frequency." },
      { role: "code", label: "Code", type: "code", required: true, hint: "Add one code block per step." },
      { role: "chart", label: "Output", type: "chart", required: false, hint: "Optional: chart the result." },
      { role: "interpretation", label: "Interpretation", type: "text", required: true, hint: "Read the output for the reader." },
      { role: "limitations", label: "Limitations", type: "text", required: true, hint: "Data, model and look-ahead caveats." },
    ],
    "Market Note": [
      TAKEAWAY,
      { role: "chart", label: "What happened", type: "chart", required: true, hint: "The move, charted, with source and timestamp." },
      { role: "context", label: "Why it happened", type: "text", required: true, hint: "Drivers, with sources." },
      { role: "interpretation", label: "What it means", type: "text", required: true, hint: "For PSX / UAE / global investors and students." },
      { role: "outlook", label: "What to watch", type: "text", required: true, hint: "Dates, levels and data releases ahead." },
      { role: "limitations", label: "Limitations", type: "text", required: true, hint: "What this note does not cover." },
    ],
    "Research Commentary": [
      TAKEAWAY,
      { role: "context", label: "The question", type: "text", required: true, hint: "The claim or question under examination." },
      { role: "concept", label: "Evidence", type: "text", required: true, hint: "Data and literature, cited." },
      { role: "chart", label: "Chart", type: "chart", required: false, hint: "Optional: the key evidence, charted." },
      { role: "interpretation", label: "Our view", type: "text", required: true, hint: "The conclusion and how confident we are." },
      { role: "limitations", label: "Counter-arguments & limitations", type: "text", required: true, hint: "The strongest case against." },
    ],
    Framework: [
      TAKEAWAY,
      { role: "context", label: "When to use it", type: "text", required: true, hint: "The decision this framework helps with." },
      { role: "concept", label: "The framework", type: "text", required: true, hint: "Its parts and how they connect." },
      { role: "steps", label: "How to apply it", type: "text", required: true, hint: "Numbered steps." },
      { role: "example", label: "Worked example", type: "text", required: true, hint: "Apply it once, end to end." },
      { role: "pitfalls", label: "Common mistakes", type: "callout", tone: "warning", required: true, hint: "Misuses to avoid." },
      { role: "limitations", label: "Limitations", type: "text", required: true, hint: "Where it stops working." },
    ],
  };

  /** Formats whose readers might act on the content: a disclaimer is required. */
  static readonly DISCLAIMER_REQUIRED: readonly ArticleFormat[] = ["Market Note", "Research Commentary", "Case Study"];

  static readonly DEFAULT_DISCLAIMER =
    "For education only. This is not investment advice or a recommendation to buy or sell any security. Past performance does not guarantee future results.";

  static sections(format: ArticleFormat): readonly FrameworkSection[] {
    return JournalFramework.SECTIONS[format];
  }

  /** Blocks for a new draft: each section's heading followed by its empty block. */
  static seed(format: ArticleFormat): Block[] {
    return JournalFramework.sections(format).flatMap((section) => {
      const block = BlockFactory.create(section.type, section.role, { tone: section.tone, title: section.label });
      if (section.role === "takeaway") return [block];
      if (section.type === "callout") return [block];
      return [BlockFactory.create("heading", undefined, { title: section.label }), block];
    });
  }

  /** A blank article of the given format. */
  static newDocument(format: ArticleFormat, slug: string): ArticleDocument {
    return {
      title: "",
      slug,
      subtitle: "",
      excerpt: "",
      format,
      category: null,
      difficulty: null,
      audience: [],
      tags: [],
      featuredImage: null,
      seo: { title: "", description: "", canonical: "", ogTitle: "", ogDescription: "", ogImage: "" },
      social: { hook: "", body: "", question: "", hashtags: [], imageUrl: "", carousel: [], status: "not-started" },
      cta: null,
      disclaimer: JournalFramework.DISCLAIMER_REQUIRED.includes(format) ? JournalFramework.DEFAULT_DISCLAIMER : "",
      sources: [],
      blocks: JournalFramework.seed(format),
    };
  }

  /** Each framework section with whether the draft has filled it. */
  static checklist(doc: ArticleDocument): SectionStatus[] {
    return JournalFramework.sections(doc.format).map((section) => {
      const blocks = doc.blocks.filter((b) => b.role === section.role);
      const filled = blocks.find(BlockFactory.isFilled);
      return {
        ...section,
        state: filled ? "done" : blocks.length > 0 ? "empty" : "missing",
        blockId: (filled ?? blocks[0])?.id ?? null,
      };
    });
  }
}
