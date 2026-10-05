import type { Course, CourseFaq, MethodStep, ModulePriority } from "../types";
import { CourseContract } from "./CourseContract";
import { CourseFormat } from "./CourseFormat";

type Keyed<T> = T & { key: number };

export type MethodDraft = Keyed<MethodStep>;
export type ModuleDraft = Keyed<{ title: string; priority: ModulePriority; summary: string; coaching: string; practice: string; deliverable: string }>;
export type OptionDraft = Keyed<{ title: string; description: string; fee: string; bookingUrl: string }>;
export type FaqDraft = Keyed<CourseFaq>;

/** The editor's state: every field as typed (strings), lists with React keys. */
export interface CourseDraftState {
  title: string;
  slug: string;
  category: string;
  eyebrow: string;
  summary: string;
  audience: string;
  notFor: string;
  difference: string;
  disclaimer: string;
  ctaLabel: string;
  bookingUrl: string;
  coachingLabel: string;
  practiceLabel: string;
  startDate: string;
  duration: string;
  price: string;
  currency: string;
  brochureUrl: string;
  seoTitle: string;
  seoDescription: string;
  testimonialTicker: string;
  method: MethodDraft[];
  modes: MethodDraft[];
  modules: ModuleDraft[];
  options: OptionDraft[];
  faqs: FaqDraft[];
}

/** Converts between a saved Course, the editor state, the save payload and the live preview. Pure. */
export class CourseDraft {
  /** A new course starts with the method stages named; the admin fills in the wording. */
  static readonly NEW_METHOD = ["Learn", "Solve", "Apply", "Revise"];

  static from(course: Course | undefined, key: () => number): CourseDraftState {
    return {
      title: course?.title ?? "",
      slug: course?.slug ?? "",
      category: course?.category ?? "",
      eyebrow: course?.eyebrow ?? "",
      summary: course?.summary ?? "",
      audience: course?.audience ?? "",
      notFor: course?.notFor ?? "",
      difference: course?.difference ?? "",
      disclaimer: course?.disclaimer ?? "",
      ctaLabel: course?.ctaLabel ?? "Book a free call",
      bookingUrl: course?.bookingUrl ?? "#book",
      coachingLabel: course?.coachingLabel ?? "Official-question coaching",
      practiceLabel: course?.practiceLabel ?? "In practice",
      startDate: course?.startDate ?? "",
      duration: course?.duration ?? "1-on-1 · flexible schedule",
      price: CourseContract.priceInput(course?.priceMinor ?? null),
      currency: course?.currency ?? "AED",
      brochureUrl: course?.brochureUrl ?? "",
      seoTitle: course?.seoTitle ?? "",
      seoDescription: course?.seoDescription ?? "",
      testimonialTicker: course?.testimonialTicker ?? "",
      method: course
        ? course.method.map((m) => ({ ...m, key: key() }))
        : CourseDraft.NEW_METHOD.map((title) => ({ title, description: "", key: key() })),
      modes: (course?.modes ?? []).map((m) => ({ ...m, key: key() })),
      modules: (course?.modules ?? []).map((m) => ({ ...m, deliverable: m.deliverable ?? "", key: key() })),
      options: (course?.options ?? []).map((o) => ({ ...o, bookingUrl: o.bookingUrl ?? "", key: key() })),
      faqs: (course?.faqs ?? []).map((f) => ({ ...f, key: key() })),
    };
  }

  /** What saveCourse receives (CourseContract.parse input). */
  static payload(draft: CourseDraftState): Record<string, unknown> {
    const strip = <T extends { key: number }>(items: T[]) =>
      items.map((item) => {
        const rest: Partial<T> = { ...item };
        delete rest.key;
        return rest;
      });
    return { ...draft, method: strip(draft.method), modes: strip(draft.modes), modules: strip(draft.modules), options: strip(draft.options), faqs: strip(draft.faqs) };
  }

  /** A best-effort Course for the preview: shows what is typed even before it validates. */
  static preview(draft: CourseDraftState, base: Pick<Course, "id" | "isActive">): Course {
    const price = CourseContract.parsePrice(draft.price);
    const payload = CourseDraft.payload(draft);
    return {
      ...base,
      slug: draft.slug,
      title: draft.title.trim() || "Untitled course",
      category: CourseContract.isCategory(draft.category) ? draft.category : CourseFormat.CATEGORIES[0],
      eyebrow: draft.eyebrow.trim(),
      summary: draft.summary.trim(),
      audience: draft.audience.trim(),
      notFor: draft.notFor.trim(),
      difference: draft.difference.trim(),
      disclaimer: draft.disclaimer.trim(),
      ctaLabel: draft.ctaLabel.trim() || "Book a free call",
      bookingUrl: CourseContract.isLink(draft.bookingUrl.trim()) ? draft.bookingUrl.trim() : "#book",
      coachingLabel: draft.coachingLabel.trim(),
      practiceLabel: draft.practiceLabel.trim(),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test(draft.startDate) ? draft.startDate : null,
      duration: draft.duration.trim(),
      priceMinor: price === "invalid" ? null : price,
      currency: /^[A-Z]{3}$/.test(draft.currency) ? draft.currency : "AED",
      method: CourseFormat.method(payload.method),
      modes: CourseFormat.method(payload.modes),
      modules: CourseFormat.modules(payload.modules),
      options: CourseFormat.options(payload.options),
      faqs: CourseFormat.faqs(payload.faqs),
      brochureUrl: draft.brochureUrl.trim() || null,
      seoTitle: draft.seoTitle,
      seoDescription: draft.seoDescription,
      testimonialTicker: null,
    };
  }
}
