"use client";

import { useState } from "react";

import { FIELD } from "@/domains/admin/components/FormField";

import { uploadArticleImage } from "../../actions/articles";

/** Upload to Blob or paste an https:// URL; shows a thumbnail. */
export function ImageField({ url, onChange, label = "Image" }: { url: string; onChange: (url: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("file", file);
    const result = await uploadArticleImage(form);
    setBusy(false);
    if ("url" in result) onChange(result.url);
    else setError(result.error);
  }

  return (
    <div>
      <span className="text-[11px] tracking-[0.22em] text-muted uppercase">{label}</span>
      <div className="mt-2 flex items-start gap-3">
        {url && (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
          <img src={url} alt="" className="h-16 w-24 shrink-0 rounded border border-line object-cover" />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            type="url"
            value={url}
            onChange={(e) => onChange(e.target.value.trim())}
            placeholder="https://… or upload"
            className={`${FIELD} mt-0 text-sm`}
          />
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-quant hover:underline">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              disabled={busy}
              onChange={(e) => {
                void upload(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {busy ? "Uploading…" : "Upload image (JPG, PNG, WebP; max 4 MB)"}
          </label>
          {error && (
            <p role="alert" className="text-xs text-gold">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
