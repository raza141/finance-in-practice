import "server-only";

import { put } from "@vercel/blob";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

/** Instructor portraits in Vercel Blob (needs BLOB_READ_WRITE_TOKEN). */
export class PhotoStorage {
  /** Below the 4.5 MB Vercel request cap and the server-action body limit in next.config.ts. */
  static readonly MAX_BYTES = 4 * 1024 * 1024;

  /** Why the file can't be used, or null when it's fine. */
  static problem(file: File): string | null {
    if (!(file.type in TYPES)) return "Use a JPG, PNG, WebP or AVIF image.";
    if (file.size > PhotoStorage.MAX_BYTES) return "Keep the photo under 4 MB.";
    return null;
  }

  /** Public https URL of the stored photo. */
  static async upload(file: File): Promise<string> {
    // ponytail: replaced photos are not deleted from Blob; prune the team/ folder if storage ever matters.
    const blob = await put(`team/portrait.${TYPES[file.type]}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return blob.url;
  }
}
