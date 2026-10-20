import type { Difficulty, QuestionInput, QuestionOption } from "../types";
import { QuestionTaxonomy } from "./QuestionTaxonomy";

export class QuestionValidationError extends Error {}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GST_OFFSET_MS = 4 * 60 * 60 * 1000;

/** Parses the admin question form. Publish times are typed in Gulf Standard Time (UTC+4, no DST). */
export class QuestionContract {
  static parse(form: FormData): QuestionInput {
    const str = (name: string, max: number) => {
      const value = String(form.get(name) ?? "")
        .replace(/\r\n?/g, "\n")
        .trim();
      if (value.length > max) throw new QuestionValidationError(`${name} is too long (max ${max} characters).`);
      return value;
    };
    const fail = (message: string): never => {
      throw new QuestionValidationError(message);
    };

    const level = Number(form.get("level"));
    if (level !== 1 && level !== 2 && level !== 3) fail("Pick a CFA level.");
    const topic = str("topic", 60);
    if (!QuestionTaxonomy.topic(topic)) fail("Pick a topic.");
    const difficulty = str("difficulty", 10) as Difficulty;
    if (!QuestionTaxonomy.DIFFICULTIES.includes(difficulty)) fail("Pick a difficulty.");

    const title = str("title", 120);
    if (title.length < 5) fail("Give the question a title (at least 5 characters).");
    const slug = str("slug", 80) || QuestionContract.slugify(title);
    if (slug.length < 3 || !SLUG.test(slug)) fail("The URL slug may only use lowercase letters, digits and single hyphens.");

    const stem = str("stem", 5000);
    if (stem.length < 10) fail("Paste the question text.");

    const options: QuestionOption[] = [0, 1, 2, 3]
      .map((i) => ({ text: str(`option${i}`, 1000), why: str(`why${i}`, 1000) }))
      .filter((o, i) => i < 3 || o.text !== "");
    if (options.some((o) => o.text === "")) fail("Options A, B and C are required (D is optional).");
    const correct = Number(form.get("correct"));
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) fail("Mark which option is correct.");

    const imageUrl = str("imageUrl", 500) || null;
    if (imageUrl && !/^https:\/\//.test(imageUrl)) fail("The solution image must be an uploaded https image.");
    const imageAlt = str("imageAlt", 300);
    if (imageUrl && !imageAlt) fail("Describe the solution image in a sentence (for screen readers and search).");

    const publishAt = form.get("status") === "publish" ? QuestionContract.fromGst(str("publishAt", 20)) : null;
    if (form.get("status") === "publish" && !publishAt) fail("Pick the date and time it goes live.");

    return {
      level: level as 1 | 2 | 3,
      topic,
      subtopic: str("subtopic", 80),
      difficulty,
      slug,
      title,
      description: str("description", 200),
      stem,
      options,
      correct,
      formula: str("formula", 2000),
      solution: str("solution", 10000),
      trap: str("trap", 2000),
      insight: str("insight", 400),
      imageUrl,
      imageAlt: imageUrl ? imageAlt : "",
      source: str("source", 200),
      publishAt,
    };
  }

  /** "Effective Duration & Convexity: Price Change" → "effective-duration-convexity-price-change". */
  static slugify(title: string): string {
    return title
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\$[^$]*\$/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80)
      .replace(/-+$/, "");
  }

  /** "2026-10-20T07:00" in GST → the instant; null when blank or malformed. */
  static fromGst(local: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
    const date = new Date(`${local}:00+04:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  /** Default publish time for a new question: 07:00 GST on the day after the last one scheduled (or tomorrow). */
  static nextSlot(lastScheduled: Date | null, now: Date = new Date()): string {
    const base = lastScheduled && lastScheduled > now ? lastScheduled : now;
    const day = new Date(`${QuestionContract.toGst(base).slice(0, 10)}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + 1);
    return `${day.toISOString().slice(0, 10)}T07:00`;
  }

  /** The instant as a datetime-local value in GST. */
  static toGst(date: Date): string {
    return new Date(date.getTime() + GST_OFFSET_MS).toISOString().slice(0, 16);
  }
}
