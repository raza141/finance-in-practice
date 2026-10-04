import type { OrderSide, Ticker, TestimonialStatus } from "../types";

/**
 * Wire contract between the Order Ticket form and `POST /api/testimonials`,
 * plus the validation both sides apply. Pure: safe to import anywhere.
 *
 * A testimonial is filed as a trade: the student "buys" (recommends) or
 * "holds" a ticker (the programme they took), with a conviction and a
 * before/after score whose relative change is the yield.
 */

export interface SubmitTestimonialRequest {
  author: string;
  email: string;
  context: string;
  country: string;
  city: string;
  ticker: string;
  side: string;
  conviction: number;
  beforeScore: number;
  afterScore: number;
  /** The review itself ("note" on the ticket). */
  quote: string;
  /** The student agreed to have their name and words published. */
  consent: boolean;
  /** Honeypot: must stay empty. Bots that auto-fill every field are dropped. */
  website?: string;
}

/** A validated submission, ready to store. */
export interface TestimonialSubmission {
  author: string;
  email: string;
  context: string;
  country: string;
  city: string;
  ticker: Ticker;
  side: OrderSide;
  conviction: number;
  beforeScore: number;
  afterScore: number;
  quote: string;
  website: string;
}

export interface SubmitTestimonialResponse {
  id: string;
  status: TestimonialStatus;
}

export type TestimonialErrorCode =
  | "INVALID_REQUEST"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "UPSTREAM_ERROR";

export interface TestimonialErrorBody {
  error: TestimonialErrorCode;
  message: string;
}

export class TestimonialValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TestimonialValidationError";
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export class TestimonialContract {
  /** Tickers and what they stand for, in dropdown order. Mirrors the CHECK in migration 008. */
  static readonly TICKERS: Readonly<Record<Ticker, string>> = {
    CFA1: "CFA® Level I",
    CFA2: "CFA® Level II",
    FRM1: "FRM® Part I",
    UNI: "University finance",
    PSX: "PSX equity analysis",
    QUANT: "Quant finance & Python",
    BIZCON: "Business consultancy",
    FINCON: "Financial consultancy",
  };

  /** Display symbols, matching the booking widget ("CFA L1", "FRM P1"). The stored codes stay CFA1/FRM1. */
  static readonly SYMBOLS: Readonly<Record<Ticker, string>> = {
    CFA1: "CFA L1",
    CFA2: "CFA L2",
    FRM1: "FRM P1",
    UNI: "UNI",
    PSX: "PSX",
    QUANT: "QUANT",
    BIZCON: "BIZ CONSULT",
    FINCON: "FIN CONSULT",
  };

  /** Suggestions for the country field, GCC first; any country can be typed. */
  static readonly COUNTRIES = [
    "United Arab Emirates",
    "Saudi Arabia",
    "Qatar",
    "Oman",
    "Kuwait",
    "Bahrain",
    "United States",
    "United Kingdom",
    "India",
    "Canada",
    "Australia",
    "Pakistan",
  ] as const;

  static readonly SIDES: Readonly<Record<OrderSide, string>> = {
    BUY: "Recommend",
    HOLD: "Mixed / neutral",
  };

  static readonly LIMITS = {
    author: { min: 2, max: 80 },
    context: { min: 2, max: 100 },
    country: { min: 2, max: 60 },
    city: { min: 2, max: 60 },
    quote: { min: 40, max: 600 },
    conviction: { min: 1, max: 10 },
    /** Scores are percentages; before must be at least 1 so the yield is defined. */
    beforeScore: { min: 1, max: 100 },
    afterScore: { min: 0, max: 100 },
  } as const;

  static readonly STATUSES: readonly TestimonialStatus[] = ["pending", "approved", "rejected"];

  /**
   * Relative change in percent, rounded to 2 dp half away from zero: the same
   * value Postgres stores in the generated yield_percent column. Integer
   * arithmetic, so the preview never disagrees with the database by a cent.
   */
  static yieldPercent(beforeScore: number, afterScore: number): number | null {
    if (!Number.isInteger(beforeScore) || !Number.isInteger(afterScore) || beforeScore < 1) return null;
    const numerator = (afterScore - beforeScore) * 10_000; // percent x 100
    const hundredths = Math.floor((2 * Math.abs(numerator) + beforeScore) / (2 * beforeScore));
    return (Math.sign(numerator) * hundredths) / 100;
  }

  /** "+45.45%", "−10.00%", "0.00%" (true minus sign, for tabular alignment). */
  static formatYield(percent: number): string {
    const sign = percent > 0 ? "+" : percent < 0 ? "−" : "";
    return `${sign}${Math.abs(percent).toFixed(2)}%`;
  }

  /** Validate and normalise an untrusted submission body. */
  static parseSubmission(body: unknown): TestimonialSubmission {
    if (!body || typeof body !== "object") throw new TestimonialValidationError("body must be a JSON object");
    const b = body as Record<string, unknown>;
    const { LIMITS } = TestimonialContract;

    const author = TestimonialContract.line(b.author);
    if (author.length < LIMITS.author.min || author.length > LIMITS.author.max) {
      throw new TestimonialValidationError(`name must be ${LIMITS.author.min}–${LIMITS.author.max} characters`);
    }

    const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
    if (email.length > 254 || !EMAIL.test(email)) {
      throw new TestimonialValidationError("email must be a valid address");
    }

    const context = TestimonialContract.line(b.context);
    if (context.length < LIMITS.context.min || context.length > LIMITS.context.max) {
      throw new TestimonialValidationError(
        `"who you are" must be ${LIMITS.context.min}–${LIMITS.context.max} characters`,
      );
    }

    const country = TestimonialContract.line(b.country);
    if (country.length < LIMITS.country.min || country.length > LIMITS.country.max) {
      throw new TestimonialValidationError(`country must be ${LIMITS.country.min}–${LIMITS.country.max} characters`);
    }
    const city = TestimonialContract.line(b.city);
    if (city.length < LIMITS.city.min || city.length > LIMITS.city.max) {
      throw new TestimonialValidationError(`city must be ${LIMITS.city.min}–${LIMITS.city.max} characters`);
    }

    if (!TestimonialContract.isTicker(b.ticker)) throw new TestimonialValidationError("choose a course ticker");
    if (!TestimonialContract.isSide(b.side)) throw new TestimonialValidationError("choose BUY or HOLD");

    const conviction = TestimonialContract.integer(b.conviction, LIMITS.conviction, "conviction");
    const beforeScore = TestimonialContract.integer(b.beforeScore, LIMITS.beforeScore, "before score");
    const afterScore = TestimonialContract.integer(b.afterScore, LIMITS.afterScore, "after score");

    const quote = TestimonialContract.paragraph(b.quote);
    if (quote.length < LIMITS.quote.min || quote.length > LIMITS.quote.max) {
      throw new TestimonialValidationError(`note must be ${LIMITS.quote.min}–${LIMITS.quote.max} characters`);
    }

    if (b.consent !== true) {
      throw new TestimonialValidationError("please confirm we may publish your name and words");
    }

    return {
      author,
      email,
      context,
      country,
      city,
      ticker: b.ticker,
      side: b.side,
      conviction,
      beforeScore,
      afterScore,
      quote,
      website: typeof b.website === "string" ? b.website : "",
    };
  }

  static isTicker(value: unknown): value is Ticker {
    return typeof value === "string" && Object.hasOwn(TestimonialContract.TICKERS, value);
  }

  static isSide(value: unknown): value is OrderSide {
    return value === "BUY" || value === "HOLD";
  }

  static isStatus(value: unknown): value is TestimonialStatus {
    return typeof value === "string" && (TestimonialContract.STATUSES as readonly string[]).includes(value);
  }

  private static integer(value: unknown, range: { min: number; max: number }, label: string): number {
    const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
    if (typeof n !== "number" || !Number.isInteger(n) || n < range.min || n > range.max) {
      throw new TestimonialValidationError(`${label} must be a whole number from ${range.min} to ${range.max}`);
    }
    return n;
  }

  /** Single line: collapse all whitespace. */
  private static line(value: unknown): string {
    return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  }

  /** Free text: keep paragraph breaks, collapse runs of spaces and blank lines. */
  private static paragraph(value: unknown): string {
    if (typeof value !== "string") return "";
    return value
      .replace(/\r\n?/g, "\n")
      .replace(/[^\S\n]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
}
