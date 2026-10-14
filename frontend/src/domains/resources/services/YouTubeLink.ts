/** Reads the 11-character video id from any YouTube link the owner pastes (or a bare id). */
export class YouTubeLink {
  private static readonly ID = /^[A-Za-z0-9_-]{11}$/;
  private static readonly HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"]);

  static id(input: string): string | null {
    const value = input.trim();
    if (YouTubeLink.ID.test(value)) return value;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split("/").filter(Boolean);
    let id: string | null | undefined = null;
    if (host === "youtu.be") id = parts[0];
    else if (YouTubeLink.HOSTS.has(host)) {
      id = parts[0] === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(parts[0] ?? "") ? parts[1] : null;
    }
    return id && YouTubeLink.ID.test(id) ? id : null;
  }

  /** Small poster image (no YouTube script until play is pressed). */
  static thumbnail(id: string): string {
    return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
  }

  /** Privacy-enhanced player: no YouTube cookies until the visitor plays. */
  static embed(id: string): string {
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  }
}
