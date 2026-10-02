import type { BookingTrack, TrackId } from "../types";

export class BookingCatalog {
  private static readonly TRACKS: readonly BookingTrack[] = [
    { id: "cfa", ticker: "CFA L1/L2", title: "CFA® Level I & II exam prep" },
    { id: "frm", ticker: "FRM P1", title: "FRM® Part I exam prep" },
    { id: "uni", ticker: "UNI FINANCE", title: "University finance mentorship" },
    { id: "systems", ticker: "SYSTEM BUILDING", title: "Financial automation & Python systems" },
  ];

  tracks(): readonly BookingTrack[] {
    return BookingCatalog.TRACKS;
  }

  track(id: TrackId): BookingTrack {
    const track = BookingCatalog.TRACKS.find((t) => t.id === id);
    if (!track) throw new Error(`Unknown booking track: ${id}`);
    return track;
  }

  /**
   * Where a simulated selection is finalised until live booking lands in
   * Phase 3. Returns null when no Cal.com event is configured.
   */
  confirmationUrl(date: string): string | null {
    const calLink = process.env.NEXT_PUBLIC_CAL_LINK?.trim();
    if (!calLink) return null;
    const url = new URL(`https://cal.com/${calLink}`);
    url.searchParams.set("date", date);
    url.searchParams.set("month", date.slice(0, 7));
    return url.toString();
  }
}
