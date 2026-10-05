import { describe, expect, it } from "vitest";

import type { AdminUser } from "@/domains/admin/types";

import type { ArticleDocument, ChartBlock, CodeBlock } from "../types";
import { ArticleContract } from "./ArticleContract";
import { ArticleExport } from "./ArticleExport";
import { ArticlePolicy } from "./ArticlePolicy";
import { ArticleValidator } from "./ArticleValidator";
import { BlockFactory } from "./BlockFactory";
import { ChartData, CsvText } from "./ChartData";
import { InlineText } from "./InlineText";
import { JournalFramework } from "./JournalFramework";

const NOW = new Date("2026-10-05T08:00:00Z");

const CHART: ChartBlock = {
  ...(BlockFactory.create("chart", "chart") as ChartBlock),
  title: "KSE-100 vs ADX General",
  csv: "date,KSE-100,ADX\n2026-09-01,81250,9512\n2026-09-02,81710,9530\n2026-09-03,82010,9541",
  unit: "index points",
  source: "PSX; ADX",
  asOf: "2026-10-03",
  methodology: "Daily closing levels, unadjusted.",
  limitations: "Price index only; excludes dividends.",
  alt: "KSE-100 rose about 1% over three sessions while ADX was flat.",
};

/** A Market Note that passes every publishing rule. */
function readyDoc(): ArticleDocument {
  const doc = JournalFramework.newDocument("Market Note", "psx-adx-september");
  const fill: Record<string, string> = {
    context: "Rates fell[^sbp].",
    interpretation: "See our [FRM course](/courses/frm-part-1) for VaR on equity books.",
    outlook: "Watch the next MPC meeting.",
    limitations: "Two markets, three sessions.",
  };
  doc.blocks = doc.blocks.map((b) => {
    if (b.type === "takeaway") return { ...b, points: ["KSE-100 outpaced ADX in early September."] };
    if (b.type === "chart") return { ...CHART, id: b.id, role: b.role };
    if (b.type === "text" && b.role) return { ...b, text: `${fill[b.role]} ${"word ".repeat(150)}` };
    return b;
  });
  return {
    ...doc,
    title: "PSX and ADX in early September",
    excerpt: "The KSE-100 outpaced the ADX General Index over the first three sessions of September.",
    category: "Markets: Pakistan, UAE & Global",
    difficulty: "Intermediate",
    audience: ["Analyst"],
    tags: ["PSX", "ADX"],
    featuredImage: { url: "https://cdn.example.com/x.png", alt: "Two index lines", caption: "" },
    seo: { ...doc.seo, description: "How the KSE-100 and ADX General moved in early September, with data sources and caveats." },
    sources: [{ id: "sbp", title: "Monetary Policy Statement", publisher: "State Bank of Pakistan", url: "https://www.sbp.org.pk", accessedAt: "2026-10-04", citation: "" }],
  };
}

describe("InlineText", () => {
  it("parses bold, italic, code, links, maths and citations", () => {
    expect(InlineText.parse("**VaR** is *a* `quantile`, see [Hull](https://x.org) and $z_{0.99}$[^hull]")).toEqual([
      { kind: "strong", children: [{ kind: "text", text: "VaR" }] },
      { kind: "text", text: " is " },
      { kind: "em", children: [{ kind: "text", text: "a" }] },
      { kind: "text", text: " " },
      { kind: "code", text: "quantile" },
      { kind: "text", text: ", see " },
      { kind: "link", href: "https://x.org", children: [{ kind: "text", text: "Hull" }] },
      { kind: "text", text: " and " },
      { kind: "math", tex: "z_{0.99}" },
      { kind: "cite", id: "hull" },
    ]);
  });

  it("leaves prices alone and honours \\$", () => {
    expect(InlineText.parse("costs $5 and $10 today")).toEqual([{ kind: "text", text: "costs $5 and $10 today" }]);
    expect(InlineText.parse("\\$x$")).toEqual([{ kind: "text", text: "$x$" }]);
  });

  it("drops unsafe link schemes to plain text", () => {
    expect(InlineText.parse("[click](javascript:void0)")).toEqual([{ kind: "text", text: "click" }]);
    expect(InlineText.parse("<script>alert(1)</script>")).toEqual([{ kind: "text", text: "<script>alert(1)</script>" }]);
    expect(InlineText.isSafeHref("//evil.com")).toBe(false);
    expect(InlineText.isSafeHref("/courses")).toBe(true);
  });

  it("splits paragraphs and lists", () => {
    expect(InlineText.paragraphs("One\nline two\n\n- a\n- b\n\n1. x\n2. y")).toEqual([
      { kind: "p", lines: ["One", "line two"] },
      { kind: "ul", items: ["a", "b"] },
      { kind: "ol", items: ["x", "y"] },
    ]);
  });
});

describe("ChartData", () => {
  it("parses CSV and Excel paste into series with a time scale", () => {
    const parsed = ChartData.parse("date\tA\tB\n2026-01-01\t1,000\t5%\n2026-01-02\t(2)\t");
    expect(parsed.ok && parsed.chart).toEqual({
      x: ["2026-01-01", "2026-01-02"],
      scale: "time",
      series: [
        { name: "A", values: [1000, -2] },
        { name: "B", values: [5, null] },
      ],
    });
  });

  it("reports the bad cell", () => {
    const parsed = ChartData.parse("x,y\n1,2\n2,abc");
    expect(parsed.ok).toBe(false);
    expect(!parsed.ok && parsed.error).toContain('Row 3, column "y"');
  });

  it("produces nice ticks covering the range", () => {
    expect(ChartData.ticks(0, 97)).toEqual([0, 20, 40, 60, 80, 100]);
    const ticks = ChartData.ticks(81250, 82010);
    expect(ticks[0]).toBeLessThanOrEqual(81250);
    expect(ticks.at(-1)).toBeGreaterThanOrEqual(82010);
  });

  it("round-trips quoted CSV", () => {
    const rows = [["name", "note"], ["a, b", 'say "hi"']];
    expect(CsvText.parse(CsvText.stringify(rows))).toEqual(rows);
  });
});

describe("JournalFramework", () => {
  it("seeds a new draft with the format's sections in order", () => {
    const doc = JournalFramework.newDocument("Explainer", "draft-1");
    expect(doc.blocks.filter((b) => b.role).map((b) => b.role)).toEqual(["takeaway", "context", "concept", "formula", "example", "chart", "pitfalls", "limitations"]);
    expect(doc.disclaimer).toBe("");
    expect(JournalFramework.newDocument("Market Note", "d").disclaimer).toBe(JournalFramework.DEFAULT_DISCLAIMER);
  });

  it("tracks which sections are done, empty or missing", () => {
    const doc = JournalFramework.newDocument("Worked Example", "d");
    doc.blocks = doc.blocks.filter((b) => b.role !== "formula");
    const checklist = JournalFramework.checklist(doc);
    expect(checklist.find((s) => s.role === "formula")?.state).toBe("missing");
    expect(checklist.find((s) => s.role === "takeaway")?.state).toBe("empty");
  });
});

describe("ArticleContract", () => {
  it("normalises untrusted JSON: drops unknown blocks and bad URLs, caps sizes", () => {
    const doc = ArticleContract.normalize({
      title: "x".repeat(500),
      format: "Nonsense",
      category: "Not a category",
      featuredImage: { url: "javascript:alert(1)", alt: "a" },
      blocks: [{ type: "script", id: "s" }, { type: "text", id: "t1", text: "hello" }, { type: "image", id: "i", url: "data:image/png;base64,xx" }],
    });
    expect(doc.title).toHaveLength(160);
    expect(doc.format).toBe("Explainer");
    expect(doc.category).toBeNull();
    expect(doc.featuredImage?.url).toBe("");
    expect(doc.blocks.map((b) => b.type)).toEqual(["text", "image"]);
    expect(doc.blocks[1].type === "image" && doc.blocks[1].url).toBe("");
  });

  it("drops script URLs from sources, chart links and the call to action", () => {
    const doc = ArticleContract.normalize({
      sources: [{ id: "a", url: "javascript:alert(1)" }, { id: "b", url: "https://www.sbp.org.pk" }],
      cta: { label: "Go", href: "javascript:alert(1)" },
      blocks: [{ type: "chart", id: "c", sourceUrl: "data:text/html,x" }],
    });
    expect(doc.sources.map((s) => s.url)).toEqual(["", "https://www.sbp.org.pk"]);
    expect(doc.cta?.href).toBe("");
    expect(doc.blocks[0].type === "chart" && doc.blocks[0].sourceUrl).toBe("");
  });

  it("refuses oversized documents", () => {
    expect(ArticleContract.parseJson("x".repeat(ArticleContract.MAX_BYTES + 1)).ok).toBe(false);
  });

  it("slugifies titles", () => {
    expect(ArticleContract.slugify("Three Ways to Compute VaR: Hull & Co.")).toBe("three-ways-to-compute-var-hull-co");
  });
});

describe("ArticleValidator", () => {
  it("passes a complete Market Note", () => {
    expect(ArticleValidator.errors(readyDoc(), { now: NOW })).toEqual([]);
  });

  it("blocks a blank draft on the required fields", () => {
    const messages = ArticleValidator.errors(JournalFramework.newDocument("Explainer", "draft-abc")).map((i) => i.message);
    for (const expected of ["Title", "Slug", "Primary category", "Featured image", "Meta description", "at least one source", 'Framework: "Executive takeaway"']) {
      expect(messages.some((m) => m.includes(expected))).toBe(true);
    }
  });

  it("requires chart provenance: source, date, unit, methodology", () => {
    const doc = readyDoc();
    doc.blocks = doc.blocks.map((b) => (b.type === "chart" ? { ...b, source: "", asOf: "", unit: "", methodology: "" } : b));
    const chartErrors = ArticleValidator.errors(doc).filter((i) => i.blockId === doc.blocks.find((b) => b.type === "chart")!.id);
    expect(chartErrors.map((i) => i.message).join(" ")).toMatch(/source[^]*as-of[^]*unit[^]*methodology/);
  });

  it("requires code to have an explanation", () => {
    const doc = readyDoc();
    const code: CodeBlock = { ...(BlockFactory.create("code") as CodeBlock), code: "print(1)" };
    doc.blocks.push(code);
    expect(ArticleValidator.errors(doc).some((i) => i.blockId === code.id && i.message.includes("explain"))).toBe(true);
  });

  it("flags citations without a source and Market Notes without a disclaimer", () => {
    const doc = { ...readyDoc(), sources: [], disclaimer: "" };
    const messages = ArticleValidator.errors(doc).map((i) => i.message);
    expect(messages).toContain("Citation [^sbp] has no matching source.");
    expect(messages.some((m) => m.includes("disclaimer"))).toBe(true);
  });

  it("checks related articles against what is published", () => {
    const doc = readyDoc();
    doc.blocks.push({ id: "rel", type: "related", slugs: ["not-live"] });
    expect(ArticleValidator.errors(doc, { publishedSlugs: new Set(["other"]), now: NOW }).map((i) => i.message)).toContain('Related article "not-live" is not published.');
  });

  it("warns when there is no internal link", () => {
    const doc = readyDoc();
    doc.blocks = doc.blocks.map((b) => (b.type === "text" ? { ...b, text: b.text.replace("/courses/frm-part-1", "https://example.com") } : b));
    expect(ArticleValidator.check(doc).some((i) => i.level === "warning" && i.message.includes("internal link"))).toBe(true);
  });
});

describe("ArticleExport", () => {
  it("builds a valid notebook with Python as code cells", () => {
    const doc = readyDoc();
    doc.blocks.push({ ...(BlockFactory.create("code") as CodeBlock), code: "import numpy as np\nprint(np.pi)", dependencies: ["numpy"] });
    const nb = JSON.parse(ArticleExport.notebook(doc, "https://financeinpractice.me/journal/x"));
    expect(nb.nbformat).toBe(4);
    const code = nb.cells.filter((c: { cell_type: string }) => c.cell_type === "code");
    expect(code).toHaveLength(1);
    expect(code[0].source.join("")).toBe("# Requires: numpy\nimport numpy as np\nprint(np.pi)");
  });

  it("drafts LinkedIn copy from the takeaway and headings", () => {
    const draft = ArticleExport.linkedinDraft(readyDoc(), "https://financeinpractice.me/journal/psx");
    expect(draft.hook).toBe("KSE-100 outpaced ADX in early September.");
    expect(draft.body).toContain("https://financeinpractice.me/journal/psx");
    expect(draft.hashtags).toEqual(["PSX", "ADX", "Markets"]);
    expect(draft.carousel[0].title).toBe("PSX and ADX in early September");
    expect(draft.carousel.at(-1)?.title).toBe("Read the full note");
  });

  it("names downloads from the title and language", () => {
    const block = { ...(BlockFactory.create("code") as CodeBlock), title: "Historical VaR", language: "python" as const };
    expect(ArticleExport.filename(block, 0)).toBe("historical_var.py");
  });
});

describe("ArticlePolicy", () => {
  const owner = { id: "o", role: "owner" } as AdminUser;
  const editor = { id: "e", role: "editor" } as AdminUser;

  it("lets owners publish anything and editors only edit their own work", () => {
    expect(ArticlePolicy.canPublish(owner)).toBe(true);
    expect(ArticlePolicy.canPublish(editor)).toBe(false);
    expect(ArticlePolicy.canEdit(editor, { authorId: "e" })).toBe(true);
    expect(ArticlePolicy.canEdit(editor, { authorId: "o" })).toBe(false);
    expect(ArticlePolicy.canEdit(owner, { authorId: "e" })).toBe(true);
    expect(ArticlePolicy.listScope(editor)).toBe("e");
    expect(ArticlePolicy.listScope(owner)).toBeNull();
  });
});
