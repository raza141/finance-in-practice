import type { Block, BlockType, CalloutTone, FrameworkRole } from "../types";

/** Empty blocks for the editor, and whether a block has been filled in. */
export class BlockFactory {
  static readonly LABELS: Readonly<Record<BlockType, string>> = {
    heading: "Heading",
    text: "Text",
    takeaway: "Executive takeaway",
    callout: "Callout",
    aside: "Margin note / pull quote",
    formula: "Formula",
    image: "Image",
    chart: "Interactive chart",
    code: "Code",
    table: "Table",
    faq: "FAQ",
    related: "Related articles",
  };

  static readonly TYPES = Object.keys(BlockFactory.LABELS) as BlockType[];

  static id(): string {
    return crypto.randomUUID().slice(0, 8);
  }

  static create(type: BlockType, role?: FrameworkRole, options: { tone?: CalloutTone; title?: string } = {}): Block {
    const base = { id: BlockFactory.id(), ...(role && { role }) };
    switch (type) {
      case "heading":
        return { ...base, type, level: 2, text: options.title ?? "" };
      case "text":
        return { ...base, type, text: "" };
      case "takeaway":
        return { ...base, type, points: [""] };
      case "callout":
        return { ...base, type, tone: options.tone ?? "note", title: options.title ?? "", text: "" };
      case "aside":
        return { ...base, type, variant: "margin", text: "" };
      case "formula":
        return { ...base, type, tex: "", explanation: "" };
      case "image":
        return { ...base, type, url: "", alt: "", caption: "", chart: null };
      case "chart":
        return {
          ...base,
          type,
          title: "",
          kind: "line",
          csv: "",
          xLabel: "",
          yLabel: "",
          unit: "",
          currency: "",
          source: "",
          sourceUrl: "",
          asOf: "",
          frequency: "daily",
          methodology: "",
          limitations: "",
          alt: "",
          caption: "",
        };
      case "code":
        return {
          ...base,
          type,
          title: "",
          language: "python",
          filename: "",
          code: "",
          explanation: "",
          output: "",
          dependencies: [],
          dataSource: "",
          limitations: "",
          downloadable: true,
        };
      case "table":
        return { ...base, type, caption: "", csv: "", source: "" };
      case "faq":
        return { ...base, type, items: [{ q: "", a: "" }] };
      case "related":
        return { ...base, type, slugs: [] };
    }
  }

  /** Has the author written anything that would render? */
  static isFilled(block: Block): boolean {
    switch (block.type) {
      case "heading":
      case "text":
      case "aside":
        return block.text.trim() !== "";
      case "takeaway":
        return block.points.some((p) => p.trim() !== "");
      case "callout":
        return block.text.trim() !== "";
      case "formula":
        return block.tex.trim() !== "";
      case "image":
        return block.url !== "";
      case "chart":
      case "table":
        return block.csv.trim() !== "";
      case "code":
        return block.code.trim() !== "";
      case "faq":
        return block.items.some((i) => i.q.trim() !== "" && i.a.trim() !== "");
      case "related":
        return block.slugs.length > 0;
    }
  }

  /** Short label for the block list, e.g. "Formula · Value at Risk". */
  static summary(block: Block): string {
    const label = BlockFactory.LABELS[block.type];
    const text = (() => {
      switch (block.type) {
        case "heading":
        case "text":
        case "aside":
          return block.text;
        case "takeaway":
          return block.points[0] ?? "";
        case "callout":
          return block.title || block.text;
        case "formula":
          return block.tex;
        case "image":
          return block.alt || block.caption;
        case "chart":
        case "code":
          return block.title;
        case "table":
          return block.caption;
        case "faq":
          return block.items[0]?.q ?? "";
        case "related":
          return block.slugs.join(", ");
      }
    })();
    const short = text.replace(/\s+/g, " ").trim().slice(0, 48);
    return short ? `${label} · ${short}` : label;
  }
}
