export type OrderSide = "BUY" | "HOLD";
export type Ticker = "CFA" | "FRM" | "PSX" | "QUANT" | "UNI";

/** The trade-ledger fields of a testimonial (migration 004). */
export interface OrderFill {
  side: OrderSide;
  ticker: Ticker;
  /** 1–10. */
  conviction: number;
  /** Percent score before and after, e.g. mock exam results. */
  beforeScore: number;
  afterScore: number;
  /** (after − before) / before, in percent, 2 dp. Negative when the score fell. */
  yieldPercent: number;
}

/** A testimonial as shown publicly. Never carries the author's email. */
export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  /** Who they are, e.g. "CFA Level II candidate" or "MSc Finance, LSE". */
  context: string;
  /** Null for testimonials submitted before the order-book format. */
  fill: OrderFill | null;
  /** Legacy (pre-004) programme label and outcome line, if any. */
  program?: string;
  outcome?: string;
}

/** Average yield per ticker across approved testimonials, for the ticker tape. */
export interface TickerQuote {
  ticker: Ticker;
  avgYieldPercent: number;
  fills: number;
}

export type TestimonialStatus = "pending" | "approved" | "rejected";

/** Full row for the admin moderation queue. */
export interface TestimonialRecord extends Testimonial {
  email: string;
  status: TestimonialStatus;
  consentAt: string;
  submittedAt: string;
  reviewedAt: string | null;
}
