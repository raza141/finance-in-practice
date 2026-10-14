"use client";

import { useState } from "react";

import { YouTubeLink } from "../services/YouTubeLink";

/**
 * Click-to-play YouTube cards: only a poster image loads with the page; the
 * player (about 0.5 MB of YouTube script) loads when a visitor presses play.
 */
export function VideoGallery({ videos }: { videos: { youtubeId: string; title: string }[] }) {
  const [playing, setPlaying] = useState<string | null>(null);
  return (
    <ul className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (
        <li key={v.youtubeId} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="relative aspect-video bg-canvas">
            {playing === v.youtubeId ? (
              <iframe
                src={YouTubeLink.embed(v.youtubeId)}
                title={v.title}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            ) : (
              <button type="button" onClick={() => setPlaying(v.youtubeId)} aria-label={`Play: ${v.title}`} className="group absolute inset-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube poster, fixed 4:3 source cropped to 16:9 */}
                <img src={YouTubeLink.thumbnail(v.youtubeId)} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100" />
                <span aria-hidden className="absolute inset-0 grid place-items-center">
                  <span className="grid h-14 w-14 place-items-center rounded-full bg-gold text-canvas shadow-lg transition-transform group-hover:scale-110">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6 4.5v11l9-5.5z" />
                    </svg>
                  </span>
                </span>
              </button>
            )}
          </div>
          <p className="p-4 font-semibold text-ink">{v.title}</p>
        </li>
      ))}
    </ul>
  );
}
