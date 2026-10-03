import type { TestimonialStatus } from "../types";

/**
 * Wire contract between the submission form and `POST /api/testimonials`,
 * plus the validation both sides apply. Pure: safe to import anywhere.
 */

export interface SubmitTestimonialRequest {
  author: string;
  email: string;
  context: string;
  program: string;
  quote: string;
  outcome?: string;
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
  program: string;
  quote: string;
  outcome: string | null;
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
  /** Courses and services a student can attribute their testimonial to. */
  static readonly PROGRAMS = [
    "CFA® exam prep",
    "FRM® exam prep",
    "University finance",
    "Financial automation",
    "Stress testing & VaR",
    "Financial modeling",
    "Portfolio construction & ML",
    "1-on-1 tutoring",
    "Consulting",
    "Other",
  ] as const;

  static readonly LIMITS = {
    author: { min: 2, max: 80 },
    context: { min: 2, max: 100 },
    quote: { min: 40, max: 600 },
    outcome: { max: 100 },
  } as const;

  static readonly STATUSES: readonly TestimonialStatus[] = ["pending", "approved", "rejected"];

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

    const program = typeof b.program === "string" ? b.program : "";
    if (!TestimonialContract.isProgram(program)) {
      throw new TestimonialValidationError("program is not recognised");
    }

    const quote = TestimonialContract.paragraph(b.quote);
    if (quote.length < LIMITS.quote.min || quote.length > LIMITS.quote.max) {
      throw new TestimonialValidationError(
        `testimonial must be ${LIMITS.quote.min}–${LIMITS.quote.max} characters`,
      );
    }

    const outcome = TestimonialContract.line(b.outcome);
    if (outcome.length > LIMITS.outcome.max) {
      throw new TestimonialValidationError(`outcome must be at most ${LIMITS.outcome.max} characters`);
    }

    if (b.consent !== true) {
      throw new TestimonialValidationError("please confirm we may publish your name and words");
    }

    return {
      author,
      email,
      context,
      program,
      quote,
      outcome: outcome || null,
      website: typeof b.website === "string" ? b.website : "",
    };
  }

  static isProgram(value: string): value is (typeof TestimonialContract.PROGRAMS)[number] {
    return (TestimonialContract.PROGRAMS as readonly string[]).includes(value);
  }

  static isStatus(value: unknown): value is TestimonialStatus {
    return typeof value === "string" && (TestimonialContract.STATUSES as readonly string[]).includes(value);
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
