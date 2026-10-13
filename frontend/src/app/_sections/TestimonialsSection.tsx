import { unstable_rethrow } from "next/navigation";

import { GridBackdrop } from "@/core/components/3d/GridBackdrop";
import { SectionHeading } from "@/core/components/ui/SectionHeading";
import { siteConfig } from "@/core/config/site";
import { GoogleReviewButton, GoogleReviewCard } from "@/domains/testimonials/components/GoogleReviews";
import { SwipeRail } from "@/domains/testimonials/components/SwipeRail";
import { GooglePlacesClient, type GoogleRating } from "@/domains/testimonials/server/GooglePlacesClient";

/**
 * Rating and reviews from the Google Business Profile. Null (button only) when
 * the Places API isn't configured or is down. Fetched once per ISR window of
 * the home page, not per visit.
 */
async function loadGoogleRating(): Promise<GoogleRating | null> {
  const client = GooglePlacesClient.fromEnv();
  if (!client) return null;
  try {
    return await client.rating();
  } catch (error) {
    // Let Next.js prerender signals through instead of baking in an empty list.
    unstable_rethrow(error);
    console.error("[reviews] could not load Google reviews", error);
    return null;
  }
}

/**
 * Landing-page social proof: Google reviews. The on-site testimonials
 * (TestimonialRepository, /admin/testimonials) are kept but no longer shown.
 */
export async function TestimonialsSection() {
  const google = await loadGoogleRating();
  const reviews = google?.reviews ?? [];

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      data-sequence="reveal"
      className="relative overflow-hidden border-t border-line"
    >
      <GridBackdrop className="absolute inset-0" />

      <div className="relative">
        <div className="page-container py-12 lg:py-16">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <SectionHeading id="testimonials-heading" eyebrow="Google reviews" title="What learners say" />
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <GoogleReviewButton summary={google} />
              <a
                href={siteConfig.contact.googleProfileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted underline decoration-quant/50 underline-offset-4 hover:text-ink"
              >
                Read all reviews on Google ↗
              </a>
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="mt-8">
              <SwipeRail label="Google reviews">
                {reviews.map((review, i) => (
                  <li
                    key={`${review.author}-${i}`}
                    className="w-[85%] shrink-0 snap-start sm:w-[calc((100%-1rem)/2)] xl:w-[calc((100%-2rem)/3)]"
                  >
                    <GoogleReviewCard review={review} />
                  </li>
                ))}
              </SwipeRail>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
