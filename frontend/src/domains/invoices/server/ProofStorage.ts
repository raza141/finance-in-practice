import "server-only";

import { get, put } from "@vercel/blob";

/**
 * Payment proofs (transfer screenshots, PDFs) in Vercel Blob, stored private:
 * they are financial records, so they are only served through the admin.
 * Needs BLOB_READ_WRITE_TOKEN and a Blob store that allows private access.
 */
export class ProofStorage {
  // ponytail: uploads go through a server action, so the 4.5 MB request cap applies.
  static readonly MAX_BYTES = 4 * 1024 * 1024;
  private static readonly TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/heic", "application/pdf"]);

  /** Why the file can't be stored, or null. Empty file inputs mean "no proof". */
  static verify(file: File): string | null {
    if (file.size > ProofStorage.MAX_BYTES) return "Keep the proof under 4 MB.";
    return ProofStorage.TYPES.has(file.type) ? null : "Upload an image (PNG, JPG, WebP, HEIC) or a PDF.";
  }

  /** The stored blob's URL (private: not openable without the token). */
  static async upload(file: File, invoiceId: string): Promise<string> {
    const blob = await put(`payment-proofs/${invoiceId}/${file.name || "proof"}`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return blob.url;
  }

  /** The proof's bytes for the admin viewer, or null when it is gone. */
  static async read(url: string): Promise<{ stream: ReadableStream<Uint8Array>; contentType: string } | null> {
    const result = await get(url, { access: "private" });
    if (!result?.stream) return null;
    return { stream: result.stream, contentType: result.blob.contentType ?? "application/octet-stream" };
  }
}
