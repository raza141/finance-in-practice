import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { ArticleExport } from "../services/ArticleExport";
import { JournalFramework } from "../services/JournalFramework";
import type { AiReview, AiReviewFinding, ArticleDocument } from "../types";

const SYSTEM = `You are the senior editor of Finance in Practice, a finance education business (CFA, FRM, quantitative finance, portfolio management, valuation, Python for finance, Pakistan/UAE/global markets). You review research notes before publication.

Review the article for:
1. Technical accuracy: formulas, worked numbers, definitions and exam conventions (CFA/FRM curriculum usage). Recompute any arithmetic you can.
2. Unsupported claims: statistics, market facts or attributions without a cited source, and anything that could be fabricated. Flag them; never invent a source.
3. Investment-advice risk: wording that reads as a recommendation to buy or sell, or a missing disclaimer where the content is market-facing.
4. Charts and code: data provenance, methodology and limitations; code that would not run or does not match the explanation.
5. Structure and clarity: whether it follows the house framework for its format, and whether a candidate at the stated level would follow it.

Be specific: say where (section or block) and what to change. Use severity "issue" for errors and anything that must be fixed before publishing, "suggestion" for improvements. If the article is sound, say so briefly and return few or no findings. Write in plain British English.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "findings"],
  properties: {
    summary: { type: "string", description: "Two or three sentences: overall verdict and the most important fix." },
    findings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "where", "comment"],
        properties: {
          severity: { type: "string", enum: ["issue", "suggestion"] },
          where: { type: "string", description: "Section heading, block or field the comment is about." },
          comment: { type: "string" },
        },
      },
    },
  },
} as const;

/**
 * Optional AI editorial review (Claude). Advisory only: it never blocks
 * publishing and never edits the article. Needs ANTHROPIC_API_KEY.
 */
export class ArticleReviewer {
  static readonly MODEL = "claude-opus-5-5";

  static isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY);
  }

  static async review(doc: ArticleDocument): Promise<AiReview> {
    const client = new Anthropic();
    const framework = JournalFramework.sections(doc.format)
      .map((s) => `- ${s.label}${s.required ? "" : " (optional)"}: ${s.hint}`)
      .join("\n");

    const response = await client.beta.messages.create({
      model: ArticleReviewer.MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `House framework for a ${doc.format}:\n${framework}\n\n<article>\n${ArticleExport.markdown(doc)}\n</article>`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      throw new Error("The reviewer declined this article. Check it manually.");
    }
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    const parsed = JSON.parse(text) as { summary: string; findings: AiReviewFinding[] };
    return {
      at: new Date().toISOString(),
      model: response.model,
      summary: parsed.summary,
      findings: parsed.findings.slice(0, 40),
    };
  }
}
