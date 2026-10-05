import katex from "katex";
import type { ReactNode } from "react";

import { InlineText, type InlineToken } from "../services/InlineText";

/** Maps a cited source id to its footnote number. */
export type CitationIndex = ReadonlyMap<string, number>;

/** KaTeX with HTML commands and \href disabled: input from the editor can't become markup or links. */
export function texToHtml(tex: string, displayMode: boolean): string {
  return katex.renderToString(tex, { displayMode, throwOnError: false, trust: false, maxSize: 20, maxExpand: 500, strict: "ignore" });
}

function Tokens({ tokens, cites }: { tokens: InlineToken[]; cites: CitationIndex }): ReactNode {
  return tokens.map((t, i) => {
    switch (t.kind) {
      case "text":
        return t.text;
      case "strong":
        return (
          <strong key={i} className="font-semibold text-ink">
            <Tokens tokens={t.children} cites={cites} />
          </strong>
        );
      case "em":
        return (
          <em key={i}>
            <Tokens tokens={t.children} cites={cites} />
          </em>
        );
      case "code":
        return (
          <code key={i} className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[0.9em] text-quant">
            {t.text}
          </code>
        );
      case "math":
        return <span key={i} dangerouslySetInnerHTML={{ __html: texToHtml(t.tex, false) }} />;
      case "cite": {
        const n = cites.get(t.id);
        return n ? (
          <sup key={i}>
            <a href={`#source-${t.id}`} className="font-mono text-[0.7em] text-quant hover:underline" aria-label={`Source ${n}`}>
              [{n}]
            </a>
          </sup>
        ) : null;
      }
      case "link": {
        const external = /^https?:\/\//i.test(t.href) && !t.href.includes("financeinpractice.me");
        return (
          <a
            key={i}
            href={t.href}
            className="text-quant underline decoration-quant/40 underline-offset-2 hover:decoration-quant"
            {...(external && { target: "_blank", rel: "noopener noreferrer" })}
          >
            <Tokens tokens={t.children} cites={cites} />
          </a>
        );
      }
    }
  });
}

/** One line of inline markup. */
export function Inline({ text, cites = new Map() }: { text: string; cites?: CitationIndex }) {
  return <Tokens tokens={InlineText.parse(text)} cites={cites} />;
}

/** Paragraphs and lists of inline markup. */
export function RichText({ text, cites = new Map(), className = "" }: { text: string; cites?: CitationIndex; className?: string }) {
  return (
    <div className={`space-y-4 leading-relaxed ${className}`}>
      {InlineText.paragraphs(text).map((p, i) => {
        if (p.kind === "p") {
          return (
            <p key={i}>
              {p.lines.map((line, j) => (
                <span key={j}>
                  {j > 0 && <br />}
                  <Inline text={line} cites={cites} />
                </span>
              ))}
            </p>
          );
        }
        const List = p.kind === "ul" ? "ul" : "ol";
        return (
          <List key={i} className={`space-y-2 pl-6 ${p.kind === "ul" ? "list-disc" : "list-decimal"} marker:text-quant`}>
            {p.items.map((item, j) => (
              <li key={j}>
                <Inline text={item} cites={cites} />
              </li>
            ))}
          </List>
        );
      })}
    </div>
  );
}
