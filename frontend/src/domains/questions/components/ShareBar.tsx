"use client";

import { useState } from "react";

/** "Copy link" and "Share on LinkedIn" for a question's permanent URL. */
export function ShareBar({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const button =
    "inline-flex h-10 items-center gap-2 rounded-md border border-line px-4 text-sm text-ink/90 transition-colors hover:border-quant/60 hover:text-quant";
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-muted">Challenge a friend</p>
      <button type="button" onClick={copy} className={button}>
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className={button}>
        Share on LinkedIn
      </a>
      <span aria-live="polite" className="sr-only">
        {copied ? "Link copied" : ""}
      </span>
    </div>
  );
}
