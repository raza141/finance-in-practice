"use client";

import { useState, type ReactNode } from "react";

import { DownloadButton } from "./DownloadButton";

/** Highlighted code with an always-visible Copy button, an optional download, and collapsible output. */
export function CodeBlockView({
  html,
  code,
  language,
  title,
  filename,
  downloadable,
  output,
  dependencies,
  children,
}: {
  html: string;
  code: string;
  language: string;
  title: string;
  filename: string;
  downloadable: boolean;
  output: string;
  dependencies: string[];
  /** Explanation and notes, rendered on the server. */
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2000);
  }

  return (
    <figure className="my-8">
      {children}
      <div className="overflow-hidden rounded-lg border border-line bg-[#22272e]">
        <div className="flex items-center justify-between gap-3 border-b border-line/80 bg-surface px-4 py-2">
          <span className="truncate font-mono text-xs text-muted">
            {title || filename} <span className="text-muted/60">· {language}</span>
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {downloadable && <DownloadButton content={code} filename={filename} label="Download" />}
            <button
              type="button"
              onClick={copy}
              aria-live="polite"
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-quant/15 px-3 text-xs font-semibold text-quant transition-colors hover:bg-quant/25"
            >
              {copied === "copied" ? "✓ Copied" : copied === "failed" ? "Copy failed" : "Copy code"}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto p-4 text-[13px] leading-relaxed [&_pre]:!bg-transparent" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
      {dependencies.length > 0 && (
        <p className="mt-2 font-mono text-xs text-muted">
          Requires: {dependencies.join(", ")}
          {language === "python" && <> · <code>pip install {dependencies.join(" ")}</code></>}
        </p>
      )}
      {output && (
        <details className="mt-2 rounded-lg border border-line bg-surface/60">
          <summary className="px-4 py-2 font-mono text-xs text-muted hover:text-ink">Output</summary>
          <pre className="overflow-x-auto border-t border-line px-4 py-3 font-mono text-[13px] text-ink/85">{output}</pre>
        </details>
      )}
    </figure>
  );
}
