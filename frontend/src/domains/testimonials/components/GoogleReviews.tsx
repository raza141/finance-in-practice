import { unstable_rethrow } from "next/navigation";

import { siteConfig } from "@/core/config/site";

import { GooglePlacesClient, type GoogleRating } from "../server/GooglePlacesClient";

/** Google's four-colour "G", unaltered. */
function GoogleGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
    </svg>
  );
}

/** Five stars, filled up to `rating` rounded to a whole star. */
function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" width={size} height={size} fill={n <= filled ? "#FBBC04" : "#DADCE0"}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/** Live rating, or null when the Places API is unset or down (e.g. the free trial ended): the buttons still show. */
async function loadRating(): Promise<GoogleRating | null> {
  const client = GooglePlacesClient.fromEnv();
  if (!client) return null;
  try {
    const rating = await client.rating();
    return rating.count > 0 ? rating : null;
  } catch (error) {
    // Let Next.js prerender signals through instead of baking in no rating.
    unstable_rethrow(error);
    console.error("[reviews] could not load the Google rating", error);
    return null;
  }
}

const BUTTON =
  "group inline-flex items-center gap-3 rounded-2xl py-2.5 pr-5 pl-2.5 transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quant";

/**
 * Two Google buttons: read the reviews (with the live rating when available)
 * and leave one. Fetched once per ISR window of the page, not per visit.
 */
export async function GoogleReviewButtons({ className = "" }: { className?: string }) {
  const summary = await loadRating();

  return (
    <div className={`flex flex-wrap gap-3 ${className}`}>
      <a
        href={siteConfig.contact.googleProfileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BUTTON} bg-white text-[#202124] shadow-[0_10px_40px_-12px_rgb(251_188_4/0.55)] ring-1 ring-black/5 hover:shadow-[0_14px_44px_-10px_rgb(251_188_4/0.7)]`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F1F3F4]">
          <GoogleGlyph size={22} />
        </span>
        <span className="flex flex-col leading-tight">
          {summary ? (
            <span className="flex items-center gap-1.5">
              <span className="font-semibold">{summary.rating.toFixed(1)}</span>
              <Stars rating={summary.rating} size={14} />
              <span className="text-xs text-[#5F6368]">
                {summary.count} {summary.count === 1 ? "review" : "reviews"}
              </span>
            </span>
          ) : (
            <span className="text-sm font-semibold">Google reviews</span>
          )}
          <span className="mt-0.5 text-sm font-medium text-[#1A73E8] group-hover:underline">Read our reviews ↗</span>
        </span>
      </a>

      <a
        href={siteConfig.contact.googleReviewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BUTTON} border border-white/15 bg-white/5 text-ink backdrop-blur-sm hover:border-[#FBBC04]/60 hover:bg-white/10`}
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-white">
          <GoogleGlyph size={22} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-semibold">Studied with us?</span>
          <span className="mt-0.5 text-xs text-muted group-hover:text-ink">Leave a review on Google ↗</span>
        </span>
      </a>
    </div>
  );
}
