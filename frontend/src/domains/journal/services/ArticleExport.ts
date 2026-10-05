import type { ArticleDocument, CarouselSlide, CodeBlock, CodeLanguage, SocialDraft } from "../types";
import { InlineText } from "./InlineText";

/** Derived outputs of an article: reading time, file downloads, notebook, LinkedIn copy. */
export class ArticleExport {
  private static readonly EXTENSIONS: Readonly<Record<CodeLanguage, string>> = {
    python: "py",
    sql: "sql",
    r: "R",
    bash: "sh",
    json: "json",
    excel: "txt",
  };

  /** Every prose string the reader sees, for citation, link and word counts. */
  static texts(doc: ArticleDocument): string[] {
    return doc.blocks.flatMap((b) => {
      switch (b.type) {
        case "text":
        case "aside":
          return [b.text];
        case "callout":
          return [b.text];
        case "takeaway":
          return b.points;
        case "faq":
          return b.items.map((i) => i.a);
        case "formula":
          return [b.explanation];
        case "code":
          return [b.explanation];
        case "chart":
          return [b.caption];
        default:
          return [];
      }
    });
  }

  static readingMinutes(doc: ArticleDocument): number {
    const words = [doc.title, ...ArticleExport.texts(doc), ...doc.blocks.flatMap((b) => (b.type === "heading" ? [b.text] : []))]
      .map(InlineText.plain)
      .join(" ")
      .split(/\s+/)
      .filter(Boolean).length;
    // ~220 wpm for prose, plus time to read each code block, formula and chart.
    const extras = doc.blocks.filter((b) => b.type === "code" || b.type === "chart" || b.type === "formula").length * 0.5;
    return Math.max(1, Math.round(words / 220 + extras));
  }

  static filename(block: CodeBlock, index: number): string {
    if (block.filename) return block.filename;
    const stem = block.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || `snippet_${index + 1}`;
    return `${stem}.${ArticleExport.EXTENSIONS[block.language]}`;
  }

  static hasPython(doc: ArticleDocument): boolean {
    return doc.blocks.some((b) => b.type === "code" && b.language === "python" && b.code.trim() !== "");
  }

  /** The article as a Jupyter notebook (nbformat 4): prose as markdown cells, Python as code cells. */
  static notebook(doc: ArticleDocument, url: string): string {
    const md = (text: string) => ({ cell_type: "markdown", metadata: {}, source: ArticleExport.lines(text) });
    const cells: object[] = [md(`# ${doc.title}\n\n${doc.subtitle ? `*${doc.subtitle}*\n\n` : ""}Source: ${url}`)];
    for (const b of doc.blocks) {
      switch (b.type) {
        case "heading":
          cells.push(md(`${"#".repeat(b.level)} ${b.text}`));
          break;
        case "text":
          cells.push(md(b.text));
          break;
        case "takeaway":
          cells.push(md(`**Key takeaways**\n\n${b.points.filter(Boolean).map((p) => `- ${p}`).join("\n")}`));
          break;
        case "callout":
          cells.push(md(`> **${b.title || "Note"}**\n>\n> ${b.text.replace(/\n/g, "\n> ")}`));
          break;
        case "formula":
          cells.push(md(`$$${b.tex}$$\n\n${b.explanation}`));
          break;
        case "code":
          if (b.explanation) cells.push(md(b.explanation));
          if (b.language === "python") {
            const deps = b.dependencies.length ? `# Requires: ${b.dependencies.join(", ")}\n` : "";
            cells.push({ cell_type: "code", execution_count: null, metadata: {}, outputs: [], source: ArticleExport.lines(deps + b.code) });
          } else cells.push(md(`\`\`\`${b.language}\n${b.code}\n\`\`\``));
          break;
        default:
          break;
      }
    }
    if (doc.disclaimer) cells.push(md(`---\n*${doc.disclaimer}*`));
    return JSON.stringify(
      {
        cells,
        metadata: { kernelspec: { display_name: "Python 3", language: "python", name: "python3" }, language_info: { name: "python" } },
        nbformat: 4,
        nbformat_minor: 5,
      },
      null,
      1,
    );
  }

  /** The whole article as Markdown, for the AI reviewer (and anyone who wants plain text). */
  static markdown(doc: ArticleDocument): string {
    const out: string[] = [`# ${doc.title}`];
    if (doc.subtitle) out.push(`*${doc.subtitle}*`);
    out.push(
      `Format: ${doc.format} · Category: ${doc.category ?? "—"} · Difficulty: ${doc.difficulty ?? "—"} · Audience: ${doc.audience.join(", ") || "—"}`,
      `Excerpt: ${doc.excerpt}`,
    );
    for (const b of doc.blocks) {
      const role = b.role ? ` [section: ${b.role}]` : "";
      switch (b.type) {
        case "heading":
          out.push(`${"#".repeat(b.level)} ${b.text}`);
          break;
        case "text":
          out.push(b.text + role);
          break;
        case "takeaway":
          out.push(`**Executive takeaway**${role}\n${b.points.map((p) => `- ${p}`).join("\n")}`);
          break;
        case "callout":
          out.push(`> **${b.tone}: ${b.title}**${role}\n> ${b.text}`);
          break;
        case "aside":
          out.push(`> (${b.variant}) ${b.text}`);
          break;
        case "formula":
          out.push(`$$${b.tex}$$${role}\n${b.explanation}`);
          break;
        case "image":
          out.push(`[Image: ${b.alt}${b.caption ? ` — ${b.caption}` : ""}${b.chart ? ` (source ${b.chart.source}, as of ${b.chart.asOf})` : ""}]`);
          break;
        case "chart":
          out.push(
            `[Chart${role}: ${b.title} (${b.kind}); unit ${b.unit} ${b.currency}; source ${b.source}, as of ${b.asOf}, ${b.frequency}]\nMethodology: ${b.methodology}\nLimitations: ${b.limitations}\nData:\n${b.csv.split("\n").slice(0, 40).join("\n")}`,
          );
          break;
        case "code":
          out.push(`${b.explanation}${role}\n\`\`\`${b.language}\n${b.code}\n\`\`\`${b.output ? `\nOutput:\n${b.output}` : ""}`);
          break;
        case "table":
          out.push(`[Table: ${b.caption}${b.source ? `; source ${b.source}` : ""}]\n${b.csv}`);
          break;
        case "faq":
          out.push(b.items.map((i) => `Q: ${i.q}\nA: ${i.a}`).join("\n\n"));
          break;
        case "related":
          out.push(`[Related: ${b.slugs.join(", ")}]`);
          break;
      }
    }
    if (doc.sources.length) {
      out.push(`## Sources\n${doc.sources.map((s) => `[^${s.id}] ${s.title}, ${s.publisher} ${s.url} (accessed ${s.accessedAt})`).join("\n")}`);
    }
    if (doc.disclaimer) out.push(`Disclaimer: ${doc.disclaimer}`);
    return out.join("\n\n");
  }

  /** A first LinkedIn draft from the takeaway, headings and tags. The author edits it before posting. */
  static linkedinDraft(doc: ArticleDocument, url: string): Omit<SocialDraft, "imageUrl" | "status"> {
    const points = (doc.blocks.find((b) => b.type === "takeaway")?.points ?? []).map(InlineText.plain).filter(Boolean);
    const hook = points[0] ?? doc.title;
    const rest = points.slice(1);
    const body = [...(rest.length ? [rest.map((p) => `→ ${p}`).join("\n")] : []), `Full note, with sources: ${url}`].join("\n\n");
    const hashtags = [...new Set([...doc.tags, ...(doc.category ? [doc.category.split(/[^A-Za-z]/)[0]] : [])])]
      .map((t) => t.replace(/[^A-Za-z0-9]/g, ""))
      .filter(Boolean)
      .slice(0, 5);

    const carousel: CarouselSlide[] = [{ title: doc.title, points: points.slice(0, 3) }];
    for (const [i, b] of doc.blocks.entries()) {
      if (b.type !== "heading" || b.level !== 2) continue;
      const next = doc.blocks.slice(i + 1).find((n) => n.type === "text" || n.type === "callout" || n.type === "formula");
      const first =
        next?.type === "formula" ? next.explanation : next && "text" in next ? InlineText.plain(next.text).split(/(?<=[.!?])\s/)[0] : "";
      carousel.push({ title: b.text, points: first ? [first] : [] });
    }
    carousel.push({ title: "Read the full note", points: [url] });

    return {
      hook,
      body,
      question: "How do you approach this in your own work or exam prep?",
      hashtags,
      carousel: carousel.slice(0, 10),
    };
  }

  /** Copy-ready LinkedIn post. */
  static linkedinText(social: SocialDraft): string {
    return [social.hook, social.body, social.question, social.hashtags.map((h) => `#${h}`).join(" ")].filter((s) => s.trim()).join("\n\n");
  }

  /** Copy-ready carousel outline, one slide per block. */
  static carouselText(social: SocialDraft): string {
    return social.carousel
      .map((s, i) => [`Slide ${i + 1}: ${s.title}`, ...s.points.map((p) => `  • ${p}`)].join("\n"))
      .join("\n\n");
  }

  /** The takeaway as a plain excerpt. */
  static excerptFromTakeaway(doc: ArticleDocument): string {
    const points = doc.blocks.find((b) => b.type === "takeaway")?.points ?? [];
    return points.map(InlineText.plain).filter(Boolean).join(" ").slice(0, 300);
  }

  /** nbformat stores source as lines that keep their newline. */
  private static lines(text: string): string[] {
    return text.split(/(?<=\n)/);
  }
}
