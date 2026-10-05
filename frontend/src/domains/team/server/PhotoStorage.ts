import "server-only";

import { put } from "@vercel/blob";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif" };

/** Admin-uploaded images in Vercel Blob: instructor portraits and research figures (needs BLOB_READ_WRITE_TOKEN). */
export class PhotoStorage {
  /** Below the 4.5 MB Vercel request cap and the server-action body limit in next.config.ts. */
  static readonly MAX_BYTES = 4 * 1024 * 1024;

  /** Why the file can't be used, or null when it's fine. */
  static problem(file: File): string | null {
    if (!(file.type in TYPES)) return "Use a JPG, PNG, WebP or AVIF image.";
    if (file.size > PhotoStorage.MAX_BYTES) return "Keep the image under 4 MB.";
    return null;
  }

  /** problem(), plus a check that the bytes really are the declared image type (the browser's type is only a claim). */
  static async verify(file: File): Promise<string | null> {
    const problem = PhotoStorage.problem(file);
    if (problem) return problem;
    const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const ascii = (from: number, to: number) => String.fromCharCode(...head.slice(from, to));
    const matches: Record<string, boolean> = {
      "image/jpeg": head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff,
      "image/png": head[0] === 0x89 && ascii(1, 4) === "PNG",
      "image/webp": ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP",
      "image/avif": ascii(4, 8) === "ftyp",
    };
    return matches[file.type] ? null : "That file isn't a valid image.";
  }

  /** Public https URL of the stored image. `name` is the Blob path stem; a random suffix is added. */
  static async upload(file: File, name = "team/portrait"): Promise<string> {
    // ponytail: replaced photos are not deleted from Blob; prune the team/ folder if storage ever matters.
    const blob = await put(`${name}.${TYPES[file.type]}`, file, {
      access: "public",
      addRandomSuffix: true,
      contentType: file.type,
    });
    return blob.url;
  }
}
