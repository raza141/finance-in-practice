import type { RegistrationInput } from "../types";

export type RegistrationResult = { ok: true; value: RegistrationInput; spam: boolean } | { ok: false; error: string };

/** Validation for the public "Register" form on /student. Pure: shared by the form and the API route. Limits mirror 037. */
export class RegistrationContract {
  static readonly OTHER = "Other";
  /** Services offered beyond the published courses (the catalogue categories without a course page). */
  static readonly EXTRA = ["Financial consultancy", "Business consultancy"] as const;
  static readonly LIMITS = { name: [2, 120], email: 254, phone: [7, 25], topic: [3, 120] } as const;
  private static readonly EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private static readonly PHONE = /^\+?[0-9 ()-]+$/;

  /** `courses` = the published course titles a visitor may pick (never drafts or internal ones). */
  static parse(body: unknown, courses: readonly string[]): RegistrationResult {
    const b = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
    const text = (key: string) => (typeof b[key] === "string" ? (b[key] as string).trim().replace(/\s+/g, " ") : "");
    const { LIMITS, OTHER } = RegistrationContract;

    const name = text("name");
    if (name.length < LIMITS.name[0] || name.length > LIMITS.name[1]) return { ok: false, error: "Add your full name." };

    const email = text("email").toLowerCase();
    if (email.length > LIMITS.email || !RegistrationContract.EMAIL.test(email)) return { ok: false, error: "Add a valid email address." };

    const phone = text("phone");
    const digits = phone.replace(/\D/g, "").length;
    if (!RegistrationContract.PHONE.test(phone) || phone.length > LIMITS.phone[1] || digits < LIMITS.phone[0]) {
      return { ok: false, error: "Add a mobile number with country code, e.g. +971 50 123 4567." };
    }

    const picked = text("course");
    let course = picked;
    if (picked === OTHER) {
      const topic = text("topic");
      if (topic.length < LIMITS.topic[0] || topic.length > LIMITS.topic[1]) return { ok: false, error: "Tell us what you'd like to study." };
      course = `${OTHER}: ${topic}`;
    } else if (!courses.includes(picked) && !(RegistrationContract.EXTRA as readonly string[]).includes(picked)) {
      return { ok: false, error: "Choose a course, or Other." };
    }

    // Honeypot: a hidden field people never fill. The route answers as usual and saves nothing.
    return { ok: true, value: { name, email, phone, course }, spam: text("website") !== "" };
  }
}
