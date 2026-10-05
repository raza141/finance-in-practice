import "server-only";

import { createHighlighter, createJavaScriptRegexEngine, type Highlighter } from "shiki";

import type { CodeLanguage } from "../types";

/**
 * Server-side syntax highlighting: readers download coloured HTML, not a
 * highlighter. One instance per warm server, with only the languages we use.
 */
export class CodeHighlighter {
  private static instance: Promise<Highlighter> | null = null;
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

  private static load(): Promise<Highlighter> {
    CodeHighlighter.instance ??= createHighlighter({
      themes: [CodeHighlighter.THEME],
      langs: Object.values(CodeHighlighter.GRAMMARS).filter((l) => l !== "text"),
      engine: createJavaScriptRegexEngine(),
    });
    return CodeHighlighter.instance;
  }
}
