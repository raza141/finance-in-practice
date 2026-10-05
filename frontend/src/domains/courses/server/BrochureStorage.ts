import "server-only";

import { put } from "@vercel/blob";

/** Course brochure PDFs in Vercel Blob (needs BLOB_READ_WRITE_TOKEN). */
export class BrochureStorage {
  // ponytail: uploads go through a server action, so the 4.5 MB request cap applies; switch to
  // @vercel/blob/client direct uploads if brochures outgrow 4 MB.
  static readonly MAX_BYTES = 4 * 1024 * 1024;

  /** Why the file can't be used, or null. Checks the %PDF header, not just the browser's claimed type. */
  static async verify(file: File): Promise<string | null> {
    if (file.size > BrochureStorage.MAX_BYTES) return "Keep the PDF under 4 MB, or commit it to public/brochures/.";
    const head = new TextDecoder().decode(await file.slice(0, 5).arrayBuffer());
    return head === "%PDF-" ? null : "That file isn't a PDF.";
  }

  /** Public https URL of the stored PDF. */
  static async upload(file: File, slug: string): Promise<string> {
    // ponytail: replaced brochures stay in Blob; prune brochures/ if storage ever matters.
    const blob = await put(`brochures/${slug || "course"}.pdf`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });
    return blob.url;
  }
}
