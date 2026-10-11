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
  /** The CSS cover preview; mirrors page 1 of the PDF (scripts/resources/build-exam-maps.mjs). */
  cover: {
    exam: string;
    facts: readonly string[];
    /** Bar widths in %, heaviest topics first; the first `gold` bars are the high-priority ones. */
    bars: readonly number[];
    gold: number;
  };
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
      cover: { exam: "CFA® Level I", facts: ["180", "2×135", "300+", "43%"], bars: [100, 92, 92, 92, 92, 55, 55, 55, 55, 74], gold: 5 },
    },
    {
      id: "cfa2-exam-map",
      title: "CFA® Level II Exam Map",
      blurb: "Topic weights, how item sets work, and a 12-week route to exam day. Two pages.",
      file: "/resources/cfa-level-ii-exam-map.pdf",
      format: "PDF · 2 pages",
      points: ["Where the marks are, topic by topic", "How item sets work, and how to pace them", "A 12-week route to exam day"],
      cover: { exam: "CFA® Level II", facts: ["22", "88", "2×132", "300+"], bars: [100, 100, 100, 100, 100, 60, 60, 60, 60, 60], gold: 5 },
    },
    {
      id: "frm1-exam-map",
      title: "FRM® Part I Exam Map",
      blurb: "Topic weights, what each topic covers, and a 12-week route to exam day. Two pages.",
      file: "/resources/frm-part-i-exam-map.pdf",
      format: "PDF · 2 pages",
      points: ["Where the marks are, topic by topic", "What each of the four topics covers", "A 12-week route to exam day"],
      cover: { exam: "FRM® Part I", facts: ["100", "4h", "240", "47%"], bars: [100, 100, 67, 67], gold: 2 },
    },
  ];

  /** The exam map shown on each exam's course page, by course ticker. */
  private static readonly BY_TICKER: Partial<Record<string, string>> = { CFA1: "cfa1-exam-map", CFA2: "cfa2-exam-map", FRM1: "frm1-exam-map" };

  /** Empty until the first Lemon Squeezy product exists; the paid section and lemon.js stay off until then. */
  static readonly PAID: readonly PaidProduct[] = [];

  static free(id: string): FreeResource | null {
    return ResourceCatalog.FREE.find((r) => r.id === id) ?? null;
  }

  static forTicker(ticker: string | null): FreeResource | null {
    const id = ticker && ResourceCatalog.BY_TICKER[ticker];
    return id ? ResourceCatalog.free(id) : null;
  }
}
