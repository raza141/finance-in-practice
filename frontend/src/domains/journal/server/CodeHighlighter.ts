import "server-only";

import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import type { CodeLanguage } from "../types";

/**
 * Server-side syntax highlighting: readers download coloured HTML, not a
 * highlighter. One instance per warm server, with only the languages we use.
 * Fine-grained imports keep the other ~300 grammars out of every function bundle.
 */
export class CodeHighlighter {
  private static instance: Promise<HighlighterCore> | null = null;
  private static readonly THEME = "github-dark-dimmed";
  private static readonly GRAMMARS: Readonly<Record<CodeLanguage, string>> = {
    python: "python",
    sql: "sql",
    r: "r",
    bash: "bash",
    json: "json",
    excel: "text",
  };

  /** Highlighted <pre> HTML. Shiki escapes the code, so the output is safe to inject. */
  static async html(code: string, language: CodeLanguage): Promise<string> {
    const highlighter = await CodeHighlighter.load();
    return highlighter.codeToHtml(code, { lang: CodeHighlighter.GRAMMARS[language], theme: CodeHighlighter.THEME });
  }

  private static load(): Promise<HighlighterCore> {
    CodeHighlighter.instance ??= createHighlighterCore({
      themes: [import("shiki/themes/github-dark-dimmed.mjs")],
      langs: [
        import("shiki/langs/python.mjs"),
        import("shiki/langs/sql.mjs"),
        import("shiki/langs/r.mjs"),
        import("shiki/langs/bash.mjs"),
        import("shiki/langs/json.mjs"),
      ],
      engine: createJavaScriptRegexEngine(),
    });
    return CodeHighlighter.instance;
  }
}
