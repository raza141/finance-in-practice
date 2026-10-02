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
}
