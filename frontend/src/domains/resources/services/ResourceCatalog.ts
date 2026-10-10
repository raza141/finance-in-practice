/** A free download, given in exchange for an email. */
export interface FreeResource {
  id: string;
  title: string;
  blurb: string;
  /** Public path of the file; swap it here when a new edition ships. */
  file: string;
  format: string;
  /** Three short lines of value shown beside the form. */
  points: readonly string[];
}

/** A paid product sold through Lemon Squeezy (hosted checkout; they handle tax, receipts and delivery). */
export interface PaidProduct {
  id: string;
  title: string;
  blurb: string;
  /** As shown, e.g. "USD 19". Lemon Squeezy charges the price set there. */
  price: string;
  format: "Notion" | "PDF";
  /** Lemon Squeezy checkout URL, e.g. https://financeinpractice.lemonsqueezy.com/buy/… */
  checkoutUrl: string;
}

/**
 * Everything on /resources. Code, not database: products change a few times a
 * year. ponytail: move to an admin editor if the list grows past a handful.
 */
export class ResourceCatalog {
  static readonly FREE: readonly FreeResource[] = [
    {
      id: "cfa1-exam-map",
      title: "CFA® Level I Exam Map",
      blurb: "Topic weights, exam format, and a 12-week route to exam day. Two pages.",
      file: "/resources/cfa-level-i-exam-map.pdf",
      format: "PDF · 2 pages",
      points: ["Where the marks are, topic by topic", "How the exam works, in four numbers", "A 12-week route to exam day"],
    },
  ];

  /** Empty until the first Lemon Squeezy product exists; the paid section and lemon.js stay off until then. */
  static readonly PAID: readonly PaidProduct[] = [];

  static free(id: string): FreeResource | null {
    return ResourceCatalog.FREE.find((r) => r.id === id) ?? null;
  }
}
