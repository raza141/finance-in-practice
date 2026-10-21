import { CourseFormat } from "@/domains/courses/services/CourseFormat";

import type { BillingBasis as Basis, CoursePrices, StudentAccountView } from "../types";

/** What the portal's "How you pay" card shows (pure). */
export interface BasisState {
  /** What they pay on now; null before the owner sets a plan or an agreement. */
  current: Basis | null;
  /** A switch they asked for that the owner hasn't answered yet. */
  requested: Basis | null;
  /** Monthly to hourly: hourly starts after this day (the current agreement month's end). */
  monthEnds: string | null;
}

/** Hourly or monthly: labels, prices and the portal card's state. */
export class BillingBasis {
  static readonly LABELS: Record<Basis, string> = { hour: "Hourly", month: "Monthly" };

  static isBasis(value: unknown): value is Basis {
    return value === "hour" || value === "month";
  }

  /** "AED 450 an hour" / "AED 3,000 a month" (+ hours), or "Agreed with you" when the course has no listed price. */
  static price(basis: Basis, prices: CoursePrices | null): { amount: string; detail: string } {
    const minor = basis === "hour" ? prices?.hourMinor : prices?.monthMinor;
    if (prices === null || minor === null || minor === undefined) {
      return { amount: "Agreed with you", detail: basis === "hour" ? "Rate set when you start" : "Fee and hours in your agreement" };
    }
    const amount = CourseFormat.price({ priceMinor: minor, currency: prices.currency });
    if (basis === "hour") return { amount, detail: "an hour, pay for the time you book" };
    return { amount, detail: prices.monthHours ? `a month, ${prices.monthHours} h of 1-on-1 included` : "a month" };
  }

  /** `requested` = the client's open request; one that already matches what they pay on is treated as done. */
  static state(account: Pick<StudentAccountView, "plan" | "agreements"> | null, requested: Basis | null): BasisState {
    const unit = account?.plan?.unit;
    const current: Basis | null = unit === "month" ? "month" : unit === "hour" || unit === "session" ? "hour" : null;
    const monthly = account?.agreements.find((a) => a.unit === "month" && a.period);
    return {
      current,
      requested: requested && requested !== current ? requested : null,
      monthEnds: current === "month" ? (monthly?.period?.end ?? null) : null,
    };
  }
}
