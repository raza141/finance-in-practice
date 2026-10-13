import { siteConfig } from "@/core/config/site";

import type { GoogleRating, GoogleReview } from "../server/GooglePlacesClient";

/** Google's four-colour "G", unaltered. */
export function GoogleGlyph({ size = 20 }: { size?: number }) {
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
export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  const filled = Math.round(rating);
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${rating.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 20 20" width={size} height={size} aria-hidden fill={n <= filled ? "#FBBC04" : "rgb(255 255 255 / 0.2)"}>
          <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z" />
        </svg>
      ))}
    </span>
  );
}

/**
 * Google-white call to action: the rating summary when the Places API is
 * configured, otherwise just the invitation. Opens the profile's review form.
 */
export function GoogleReviewButton({ summary }: { summary: Pick<GoogleRating, "rating" | "count"> | null }) {
  const rated = summary && summary.count > 0;
  return (
    <a
      href={siteConfig.contact.googleReviewUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-4 rounded-2xl bg-white py-3 pr-5 pl-4 text-[#202124] shadow-[0_10px_40px_-12px_rgb(251_188_4/0.55)] ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-[0_14px_44px_-10px_rgb(251_188_4/0.7)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-quant"
    >
      <span className="grid h-11 w-11 place-items-center rounded-full bg-[#F1F3F4]">
        <GoogleGlyph size={24} />
      </span>
      <span className="flex flex-col">
        {rated ? (
          <span className="flex items-center gap-2">
            <span className="text-lg leading-none font-semibold">{summary.rating.toFixed(1)}</span>
            <Stars rating={summary.rating} />
            <span className="text-sm text-[#5F6368]">
              {summary.count} {summary.count === 1 ? "review" : "reviews"}
            </span>
          </span>
        ) : (
          <Stars rating={5} />
        )}
        <span className="mt-1 text-sm font-medium text-[#1A73E8] group-hover:underline">
          {rated ? "Studied with us? Write a review" : "Studied with us? Review us on Google"} ↗
        </span>
      </span>
    </a>
  );
}

/** One Google review, attributed as Google requires: reviewer name linked to their profile, Google's time wording. */
export function GoogleReviewCard({ review }: { review: GoogleReview }) {
  const name = review.authorUrl ? (
    <a href={review.authorUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink hover:underline">
      {review.author}
    </a>
  ) : (
    <span className="font-semibold text-ink">{review.author}</span>
  );

  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-surface/80 p-5 backdrop-blur-sm sm:p-6">
      <header className="flex items-center gap-3">
        {review.photoUrl ? (
          // Reviewer photos live on googleusercontent.com; skip the image optimizer.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.photoUrl} alt="" width={40} height={40} referrerPolicy="no-referrer" className="h-10 w-10 rounded-full" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-quant/15 font-semibold text-quant">
            {review.author.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1 text-sm">
          {name}
          <span className="block text-xs text-muted">{review.when}</span>
        </div>
        <GoogleGlyph size={18} />
      </header>
      <div className="mt-4">
        <Stars rating={review.rating} size={15} />
      </div>
      <blockquote className="mt-3 flex-1 text-[15px] leading-relaxed whitespace-pre-line text-ink/90">{review.text}</blockquote>
      <footer className="mt-4 text-xs text-muted">Posted on Google</footer>
    </article>
  );
}
