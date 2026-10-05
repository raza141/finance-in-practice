"use client";

/** Saves text the page already has (code, CSV, a notebook) as a file; nothing is fetched or stored. */
export function DownloadButton({
  content,
  filename,
  type = "text/plain",
  label,
  className = "",
}: {
  content: string;
  filename: string;
  type?: string;
  label: string;
  className?: string;
}) {
  function download() {
    const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={download}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-muted transition-colors hover:border-quant/60 hover:text-ink ${className}`}
    >
      <span aria-hidden>↓</span> {label}
    </button>
  );
}
