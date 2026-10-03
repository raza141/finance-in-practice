import type { Article } from "../types";

/**
 * Read model for Journal articles. Static today; add an entry here to publish.
 * Swap the data source for a CMS later without touching the pages.
 */
export class JournalCatalog {
  private static readonly ARTICLES: readonly Article[] = [
    {
      slug: "three-ways-to-compute-var",
      title: "Three ways to compute Value at Risk",
      summary:
        "Parametric, historical and Monte Carlo VaR answer the same question with different assumptions. Here is when each one earns its place.",
      publishedAt: "2026-10-04",
      tags: ["Risk", "FRM", "Python"],
      sections: [
        {
          paragraphs: [
            "Value at Risk asks one question: over a given horizon, what loss will not be exceeded with a given confidence? A one-day 99% VaR of 1 million means that on 99 days out of 100 the portfolio should lose less than 1 million. The three standard methods differ only in how they model the distribution of returns.",
          ],
        },
        {
          heading: "Parametric (variance-covariance)",
          paragraphs: [
            "Assume returns are normally distributed, estimate the portfolio's volatility from the covariance matrix, and scale it by the z-score for the chosen confidence level (2.33 at 99%). It is fast and transparent, which is why it dominates exam questions, but it understates fat-tailed losses.",
          ],
        },
        {
          heading: "Historical simulation",
          paragraphs: [
            "Revalue today's portfolio under every daily return in a look-back window, sort the resulting P&L and read off the loss at the chosen percentile. No distribution is assumed, so fat tails and skew in the data come through, but the answer is only as good as the window: a calm year produces a calm VaR.",
          ],
        },
        {
          heading: "Monte Carlo simulation",
          paragraphs: [
            "Specify a model for the risk factors, simulate thousands of scenarios, revalue the portfolio in each and take the percentile. It handles options and other non-linear payoffs that the parametric method gets wrong, at the cost of computation time and model risk.",
          ],
        },
        {
          heading: "Which one to use",
          paragraphs: [
            "For a linear portfolio and a quick answer, parametric VaR is fine. For realistic tails with enough data, use historical simulation. For options books or path-dependent exposure, Monte Carlo is the honest choice. In practice, run more than one: when they disagree, the disagreement is the insight.",
          ],
        },
      ],
    },
  ];

  /** Newest first. */
  all(): readonly Article[] {
    return [...JournalCatalog.ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  }

  bySlug(slug: string): Article | undefined {
    return JournalCatalog.ARTICLES.find((article) => article.slug === slug);
  }

  /** "4 October 2026". Calendar dates, so format in UTC. */
  static date(iso: string): string {
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
      new Date(`${iso}T00:00:00Z`),
    );
  }
}
