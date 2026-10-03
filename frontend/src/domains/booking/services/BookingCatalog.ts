import type { BookingTrack, TrackId } from "../types";

export class BookingCatalog {
  private static readonly TRACKS: readonly BookingTrack[] = [
    { id: "cfa", ticker: "CFA L1/L2", blurb: "Level I & II exam prep", title: "CFA® Level I & II exam prep" },
    { id: "frm", ticker: "FRM P1", blurb: "Part I exam prep", title: "FRM® Part I exam prep" },
    { id: "uni", ticker: "UNI FINANCE", blurb: "Coursework & mentorship", title: "University finance mentorship" },
    { id: "systems", ticker: "SYSTEM BUILDING", blurb: "Python & automation", title: "Financial automation & Python systems" },
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
