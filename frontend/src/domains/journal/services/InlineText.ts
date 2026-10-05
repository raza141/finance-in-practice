export type InlineToken =
  | { kind: "text"; text: string }
  | { kind: "strong"; children: InlineToken[] }
  | { kind: "em"; children: InlineToken[] }
  | { kind: "code"; text: string }
  | { kind: "math"; tex: string }
  | { kind: "cite"; id: string }
  | { kind: "link"; href: string; children: InlineToken[] };

export type Paragraph = { kind: "p"; lines: string[] } | { kind: "ul" | "ol"; items: string[] };

/**
 * The small markup language of text blocks, parsed into tokens that React
 * renders as elements. There is deliberately no HTML: nothing typed in the
 * editor can become markup on the public site.
 *
 *   **bold**  *italic*  `code`  [label](https://…)  $\sigma^2$  [^source-id]
 *
 * Inline maths follows Pandoc's rule so prices don't turn into maths: the
 * opening $ must touch a non-space, the closing $ must follow a non-space and
 * not precede a digit ("$5 and $10" stays text). Write \$ for a literal $.
 */
export class InlineText {
  private static readonly PATTERN =
    /\\([\\`*$[\]_])|`([^`\n]+)`|\$(?=\S)((?:\\\$|[^$\n])+?)(?<=\S)\$(?!\d)|\[\^([A-Za-z0-9_-]+)\]|\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*(?=\S)(.+?)(?<=\S)\*\*|\*(?=[^\s*])(.+?)(?<=\S)\*/g;

  private static readonly SAFE_HREF = /^(https?:\/\/|\/(?!\/)|#|mailto:)/i;

  static parse(input: string): InlineToken[] {
    const tokens: InlineToken[] = [];
    const push = (token: InlineToken) => {
      const last = tokens.at(-1);
      if (token.kind === "text" && last?.kind === "text") last.text += token.text;
      else tokens.push(token);
    };
    const pattern = new RegExp(InlineText.PATTERN.source, "g");
    let cursor = 0;
    for (let m = pattern.exec(input); m; m = pattern.exec(input)) {
      if (m.index > cursor) push({ kind: "text", text: input.slice(cursor, m.index) });
      cursor = m.index + m[0].length;
      const [, escaped, code, math, cite, label, href, strong, em] = m;
      if (escaped !== undefined) push({ kind: "text", text: escaped });
      else if (code !== undefined) push({ kind: "code", text: code });
      else if (math !== undefined) push({ kind: "math", tex: math.replace(/\\\$/g, "$") });
      else if (cite !== undefined) push({ kind: "cite", id: cite });
      else if (label !== undefined && href !== undefined) {
        if (InlineText.isSafeHref(href)) push({ kind: "link", href, children: InlineText.parse(label) });
        else push({ kind: "text", text: label });
      } else if (strong !== undefined) push({ kind: "strong", children: InlineText.parse(strong) });
      else if (em !== undefined) push({ kind: "em", children: InlineText.parse(em) });
    }
    if (cursor < input.length) push({ kind: "text", text: input.slice(cursor) });
    return tokens;
  }

  static isSafeHref(href: string): boolean {
    return InlineText.SAFE_HREF.test(href.trim());
  }

  /** Blank lines separate paragraphs; a run of "- " or "1. " lines is a list. */
  static paragraphs(text: string): Paragraph[] {
    return text
      .replace(/\r\n?/g, "\n")
      .split(/\n\s*\n/)
      .map((chunk) => chunk.split("\n").filter((line) => line.trim() !== ""))
      .filter((lines) => lines.length > 0)
      .map((lines): Paragraph => {
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) return { kind: "ul", items: lines.map((l) => l.replace(/^\s*[-*]\s+/, "")) };
        if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) return { kind: "ol", items: lines.map((l) => l.replace(/^\s*\d+[.)]\s+/, "")) };
        return { kind: "p", lines };
      });
  }

  /** Plain words, for reading time, excerpts and social copy. */
  static plain(text: string): string {
    return text
      .replace(/\[\^[A-Za-z0-9_-]+\]/g, "")
      .replace(/\[([^\]\n]+)\]\([^)\s]+\)/g, "$1")
      .replace(/[*`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Every [^id] cited in the text. */
  static citations(text: string): string[] {
    return [...text.matchAll(/(?<!\\)\[\^([A-Za-z0-9_-]+)\]/g)].map((m) => m[1]);
  }

  /** Every link target, to check for internal links. */
  static links(text: string): string[] {
    return [...text.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)].map((m) => m[1]);
  }
}
