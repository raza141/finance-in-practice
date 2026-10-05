"use client";

import { startTransition, useActionState, useEffect, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { TestimonialContract } from "@/domains/testimonials/services/TestimonialContract";
import type { Testimonial } from "@/domains/testimonials/types";

import { saveCourse, uploadCourseBrochure, type CourseFormState, type CourseIntent } from "../actions/courses";
import { CourseContract, type CourseInput } from "../services/CourseContract";
import { CourseDraft, type CourseDraftState, type ModuleDraft } from "../services/CourseDraft";
import { CourseFormat } from "../services/CourseFormat";
import type { Course } from "../types";
import { CourseView } from "./CourseView";
import { RepeatableList, listKey } from "./RepeatableList";

const noSubscribe = () => () => {};

const TABS = {
  basics: { label: "Basics", fields: ["title", "slug", "category", "eyebrow", "tagline", "summary", "audience", "notFor"] },
  method: { label: "Coaching method", fields: ["method", "modes"] },
  modules: { label: "Modules", fields: ["modules", "coachingLabel", "practiceLabel", "weightLabel"] },
  options: { label: "Engagement options", fields: ["options"] },
  faqs: { label: "FAQs", fields: ["faqs"] },
  conversion: {
    label: "Conversion",
    fields: ["ctaLabel", "bookingUrl", "difference", "duration", "startDate", "priceMinor", "currency", "testimonialTicker", "disclaimer"],
  },
  publishing: { label: "Publishing", fields: ["brochureUrl", "seoTitle", "seoDescription"] },
} as const satisfies Record<string, { label: string; fields: readonly (keyof CourseInput)[] }>;
type Tab = keyof typeof TABS;

/**
 * The one editor for every course: tabbed sections on the left, the real
 * public page (CourseView) as a live preview on the right. Saves the whole
 * course as JSON; the server re-validates and checks the role.
 */
export function CourseEditor({
  course,
  canPublish,
  testimonials,
}: {
  course?: Course;
  /** Owners publish; editors only save drafts. */
  canPublish: boolean;
  /** Approved testimonials, filtered by the chosen ticker for the preview. */
  testimonials: readonly Testimonial[];
}) {
  const [state, action, saving] = useActionState<CourseFormState, FormData>(saveCourse, {});
  // False during SSR and hydration: keep fields disabled until React owns them,
  // or text typed before hydration is overwritten by the initial state.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const live = course?.isActive ?? false;
  const locked = live && !canPublish;
  const pending = saving || !hydrated || locked;

  const [draft, setDraft] = useState<CourseDraftState>(() => CourseDraft.from(course, listKey));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(CourseDraft.payload(draft)));
  const [slugTouched, setSlugTouched] = useState(Boolean(course));
  const [tab, setTab] = useState<Tab>("basics");
  const [view, setView] = useState<"edit" | "preview">("edit");
  const set = (patch: Partial<CourseDraftState>) => setDraft((d) => ({ ...d, ...patch }));

  const errors = state.errors ?? {};
  const payloadJson = JSON.stringify(CourseDraft.payload(draft));
  const dirty = payloadJson !== savedJson;

  // A successful save makes the current draft the saved baseline.
  const [seenSave, setSeenSave] = useState(state.savedAt);
  if (state.savedAt !== seenSave) {
    setSeenSave(state.savedAt);
    setSavedJson(payloadJson);
  }

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData();
    if (course) data.set("id", course.id);
    data.set("intent", (submitter?.value as CourseIntent) ?? "save");
    data.set("payload", payloadJson);
    startTransition(() => action(data));
  };

  const preview = CourseDraft.preview(draft, { id: course?.id ?? "preview", isActive: live });
  const previewTestimonials = TestimonialContract.isTicker(draft.testimonialTicker)
    ? testimonials.filter((t) => t.fill?.ticker === draft.testimonialTicker).slice(0, 6)
    : [];

  const text = (field: keyof CourseDraftState & keyof CourseInput, label: string, props: { hint?: ReactNode; max?: number; rows?: number; className?: string; placeholder?: string } = {}) => (
    <Field label={label} error={errors[field]} hint={props.hint} className={props.className}>
      {props.rows ? (
        <textarea
          rows={props.rows}
          maxLength={props.max}
          placeholder={props.placeholder}
          value={draft[field] as string}
          aria-invalid={errors[field] ? true : undefined}
          onChange={(e) => set({ [field]: e.target.value })}
          className={`${FIELD} resize-y leading-relaxed`}
        />
      ) : (
        <input
          maxLength={props.max}
          placeholder={props.placeholder}
          value={draft[field] as string}
          aria-invalid={errors[field] ? true : undefined}
          onChange={(e) => set({ [field]: e.target.value })}
          className={FIELD}
        />
      )}
    </Field>
  );
  const counter = (value: string, max: number) => `${value.trim().length} / ${max}`;

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 xl:grid-cols-2">
      <div className={view === "preview" ? "hidden xl:block" : ""}>
        <nav aria-label="Course sections" className="flex flex-wrap gap-1 border-b border-line pb-3">
          {(Object.keys(TABS) as Tab[]).map((key) => {
            const hasError = TABS[key].fields.some((f) => errors[f]);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-current={tab === key ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${tab === key ? "bg-surface-raised text-ink" : "text-muted hover:text-ink"}`}
              >
                {TABS[key].label}
                {hasError && <span className="ml-1.5 text-gold" aria-label="has errors">●</span>}
              </button>
            );
          })}
        </nav>

        {locked && (
          <p role="status" className="mt-5 rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-gold">
            This course is live. Only an owner can edit or unpublish it.
          </p>
        )}

        <fieldset disabled={pending} className="mt-6 grid gap-5">
          {tab === "basics" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Title" error={errors.title} className="sm:col-span-2">
                <input
                  maxLength={120}
                  value={draft.title}
                  aria-invalid={errors.title ? true : undefined}
                  onChange={(e) => set({ title: e.target.value, ...(!slugTouched && { slug: CourseContract.slugify(e.target.value) }) })}
                  className={FIELD}
                />
              </Field>
              <Field
                label="URL slug"
                error={errors.slug}
                hint={
                  <>
                    /courses/{draft.slug || "…"}
                    {course && course.slug !== draft.slug && " · the old address will stop working"}
                  </>
                }
              >
                <input
                  maxLength={80}
                  value={draft.slug}
                  aria-invalid={errors.slug ? true : undefined}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: e.target.value.toLowerCase() });
                  }}
                  className={FIELD}
                />
              </Field>
              <Field label="Category" error={errors.category}>
                <select value={draft.category} aria-invalid={errors.category ? true : undefined} onChange={(e) => set({ category: e.target.value })} className={FIELD}>
                  <option value="" disabled>
                    Choose…
                  </option>
                  {CourseFormat.CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              {text("eyebrow", "Eyebrow", { max: 40, placeholder: "e.g. Exam coaching", hint: "Small label above the title. Blank shows the category." })}
              {text("tagline", "Tagline", { max: 80, placeholder: "e.g. Learn it by doing it.", hint: "Italic line under the title. Optional." })}
              {text("summary", "Positioning statement", { rows: 3, max: 600, className: "sm:col-span-2", hint: `${counter(draft.summary, 600)} · under the title and on course cards` })}
              {text("audience", "Who it is for", { rows: 3, max: 800, className: "sm:col-span-2" })}
              {text("notFor", "Who it is not for", { rows: 2, max: 800, className: "sm:col-span-2" })}
            </div>
          )}

          {tab === "method" && (
            <RepeatableList
              items={draft.method}
              onChange={(method) => set({ method })}
              create={() => ({ key: listKey(), title: "", description: "" })}
              max={CourseContract.LIMITS.method}
              noun="Step"
              disabled={pending}
              error={errors.method}
            >
              {(step, update) => (
                <>
                  <input aria-label="Step title" placeholder="e.g. Prepare" maxLength={80} value={step.title} onChange={(e) => update({ title: e.target.value })} className={`${FIELD} mt-0`} />
                  <textarea aria-label="Step description" placeholder="What happens at this stage" rows={3} maxLength={400} value={step.description} onChange={(e) => update({ description: e.target.value })} className={`${FIELD} mt-0 resize-y`} />
                </>
              )}
            </RepeatableList>
          )}

          {tab === "method" && (
            <div className="mt-6 border-t border-line pt-6">
              <p className="mb-4 text-[11px] tracking-[0.22em] text-muted uppercase">Ways to learn · shown under the method</p>
              <RepeatableList
                items={draft.modes}
                onChange={(modes) => set({ modes })}
                create={() => ({ key: listKey(), title: "", description: "" })}
                max={CourseContract.LIMITS.modes}
                noun="Way"
                disabled={pending}
                error={errors.modes}
              >
                {(mode, update) => (
                  <>
                    <input aria-label="Way to learn" placeholder="e.g. Self-study" maxLength={80} value={mode.title} onChange={(e) => update({ title: e.target.value })} className={`${FIELD} mt-0`} />
                    <textarea aria-label="Description" placeholder="How it works" rows={2} maxLength={400} value={mode.description} onChange={(e) => update({ description: e.target.value })} className={`${FIELD} mt-0 resize-y`} />
                  </>
                )}
              </RepeatableList>
            </div>
          )}

          {tab === "modules" && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                {text("coachingLabel", "Coaching line label", { max: 40, hint: "e.g. Official-question coaching, Code review" })}
                {text("practiceLabel", "Practice line label", { max: 40, hint: "e.g. In practice, Build" })}
                {text("weightLabel", "Weight line label", { max: 40, hint: "e.g. Official weight (2027). Blank hides the weight line." })}
              </div>
              <RepeatableList
                items={draft.modules}
                onChange={(modules) => set({ modules })}
                create={(): ModuleDraft => ({ key: listKey(), title: "", priority: "core", summary: "", coaching: "", practice: "", deliverable: "", weight: "" })}
                max={CourseContract.LIMITS.modules}
                noun="Module"
                disabled={pending}
                error={errors.modules}
              >
                {(module, update) => (
                  <>
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem_11rem]">
                      <input aria-label="Module title" placeholder="Module title, e.g. Fixed Income" maxLength={160} value={module.title} onChange={(e) => update({ title: e.target.value })} className={`${FIELD} mt-0`} />
                      <input aria-label="Weight" placeholder="Weight, e.g. 10–15%" maxLength={40} value={module.weight} onChange={(e) => update({ weight: e.target.value })} className={`${FIELD} mt-0`} />
                      <select aria-label="Priority" value={module.priority} onChange={(e) => update({ priority: e.target.value as typeof module.priority })} className={`${FIELD} mt-0`}>
                        {Object.entries(CourseFormat.PRIORITIES).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input aria-label="One-line outcome" placeholder="One-line outcome" maxLength={300} value={module.summary} onChange={(e) => update({ summary: e.target.value })} className={`${FIELD} mt-0`} />
                    <textarea aria-label={draft.coachingLabel || "Coaching"} placeholder={`${draft.coachingLabel || "Coaching"}…`} rows={2} maxLength={600} value={module.coaching} onChange={(e) => update({ coaching: e.target.value })} className={`${FIELD} mt-0 resize-y`} />
                    <textarea aria-label={draft.practiceLabel || "Practice"} placeholder={`${draft.practiceLabel || "Practice"}…`} rows={2} maxLength={600} value={module.practice} onChange={(e) => update({ practice: e.target.value })} className={`${FIELD} mt-0 resize-y`} />
                    <input aria-label="Student deliverable" placeholder="Student deliverable (optional)" maxLength={300} value={module.deliverable} onChange={(e) => update({ deliverable: e.target.value })} className={`${FIELD} mt-0`} />
                  </>
                )}
              </RepeatableList>
            </>
          )}

          {tab === "options" && (
            <RepeatableList
              items={draft.options}
              onChange={(options) => set({ options })}
              create={() => ({ key: listKey(), title: "", description: "", fee: "", bookingUrl: "" })}
              max={CourseContract.LIMITS.options}
              noun="Option"
              disabled={pending}
              error={errors.options}
            >
              {(option, update) => (
                <>
                  <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                    <input aria-label="Option title" placeholder="e.g. Single session" maxLength={80} value={option.title} onChange={(e) => update({ title: e.target.value })} className={`${FIELD} mt-0`} />
                    <input aria-label="Fee" placeholder="e.g. AED 450 / session" maxLength={60} value={option.fee} onChange={(e) => update({ fee: e.target.value })} className={`${FIELD} mt-0`} />
                  </div>
                  <textarea aria-label="Option description" placeholder="What is included" rows={2} maxLength={400} value={option.description} onChange={(e) => update({ description: e.target.value })} className={`${FIELD} mt-0 resize-y`} />
                  <input aria-label="Booking link (optional)" placeholder="Booking link (optional; defaults to the course link)" maxLength={500} value={option.bookingUrl} onChange={(e) => update({ bookingUrl: e.target.value })} className={`${FIELD} mt-0`} />
                </>
              )}
            </RepeatableList>
          )}

          {tab === "faqs" && (
            <RepeatableList
              items={draft.faqs}
              onChange={(faqs) => set({ faqs })}
              create={() => ({ key: listKey(), question: "", answer: "" })}
              max={CourseContract.LIMITS.faqs}
              noun="FAQ"
              disabled={pending}
              error={errors.faqs}
            >
              {(faq, update) => (
                <>
                  <input aria-label="Question" placeholder="Question" maxLength={200} value={faq.question} onChange={(e) => update({ question: e.target.value })} className={`${FIELD} mt-0`} />
                  <textarea aria-label="Answer" placeholder="Answer" rows={3} maxLength={1200} value={faq.answer} onChange={(e) => update({ answer: e.target.value })} className={`${FIELD} mt-0 resize-y`} />
                </>
              )}
            </RepeatableList>
          )}

          {tab === "conversion" && (
            <div className="grid gap-5 sm:grid-cols-2">
              {text("ctaLabel", "CTA label", { max: 40, placeholder: "Book a free diagnostic" })}
              {text("bookingUrl", "Booking link", { max: 500, hint: "#book = the booking calendar on the page. Or /contact, or an https:// link." })}
              {text("difference", "What makes it different", {
                rows: 3,
                max: 800,
                className: "sm:col-span-2",
                hint: "First line is the headline; the rest is the body.",
              })}
              {text("duration", "Format", { max: 40, hint: 'e.g. "1-on-1 · flexible schedule"' })}
              <Field label="Next start" error={errors.startDate} hint="Blank shows “On request”.">
                <input type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} className={FIELD} />
              </Field>
              <Field label="Headline fee" error={errors.priceMinor} hint="Blank = on request, 0 = free. Invoices and client plans use it.">
                <input inputMode="decimal" placeholder="On request" value={draft.price} onChange={(e) => set({ price: e.target.value })} className={`${FIELD} tabular-data`} />
              </Field>
              <Field label="Currency" error={errors.currency}>
                <select value={draft.currency} onChange={(e) => set({ currency: e.target.value })} className={FIELD}>
                  {CourseContract.CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Testimonials" error={errors.testimonialTicker} hint="Approved testimonials with this ticker show on the page." className="sm:col-span-2">
                <select value={draft.testimonialTicker} onChange={(e) => set({ testimonialTicker: e.target.value })} className={FIELD}>
                  <option value="">None</option>
                  {Object.entries(TestimonialContract.TICKERS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              {text("disclaimer", "Disclaimer", { rows: 3, max: 800, className: "sm:col-span-2", hint: "Small print at the foot of the page, e.g. trademark notices." })}
            </div>
          )}

          {tab === "publishing" && (
            <div className="grid gap-5">
              <p className="text-sm">
                Status:{" "}
                <span className={live ? "text-quant" : "text-muted"}>{live ? "● Published" : "○ Draft (returns “not found” publicly)"}</span>
              </p>
              <BrochureField url={draft.brochureUrl} slug={draft.slug} error={errors.brochureUrl} onChange={(brochureUrl) => set({ brochureUrl })} />
              {text("seoTitle", "SEO title", { max: 70, hint: `${counter(draft.seoTitle, 70)} · blank uses the course title` })}
              {text("seoDescription", "SEO description", { rows: 2, max: 170, hint: `${counter(draft.seoDescription, 170)} · blank uses the positioning statement` })}
            </div>
          )}
        </fieldset>

        <div className="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center gap-3 border-t border-line bg-canvas/95 py-4 backdrop-blur">
          <button
            type="submit"
            value="save"
            disabled={pending}
            className="h-10 rounded-md border border-line px-5 text-sm font-semibold transition-colors hover:border-quant/60 disabled:cursor-wait disabled:opacity-60"
          >
            {saving ? "Saving…" : live ? "Save changes" : "Save draft"}
          </button>
          {canPublish && (
            <button
              type="submit"
              value={live ? "unpublish" : "publish"}
              disabled={pending}
              className={`h-10 rounded-md px-5 text-sm font-semibold transition-colors disabled:opacity-60 ${live ? "text-muted hover:text-ink" : "bg-gold text-canvas hover:bg-gold-bright"}`}
            >
              {live ? "Unpublish" : course ? "Save & publish" : "Create & publish"}
            </button>
          )}
          <span className="text-sm text-muted">{dirty ? "Unsaved changes" : state.savedAt ? "All changes saved" : ""}</span>
          {state.message && (
            <p role="alert" className={`w-full text-sm ${state.errors ? "text-gold" : "text-quant"}`}>
              {state.message}
            </p>
          )}
        </div>
      </div>

      <div className={view === "edit" ? "hidden xl:block" : ""}>
        <div className="sticky top-4">
          <p className="mb-2 font-mono text-[11px] tracking-[0.22em] text-muted uppercase">Live preview · /courses/{draft.slug || "…"}</p>
          {/* Links are inert here so a click can't navigate away from unsaved work. */}
          <div
            onClickCapture={(e) => {
              if ((e.target as HTMLElement).closest("a")) e.preventDefault();
            }}
            className="h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-line bg-canvas"
          >
            {/* Zoom an inner wrapper: zoom on the scroll box would halve its height too. */}
            <div className="xl:[zoom:0.5]">
            <CourseView
              course={preview}
              testimonials={previewTestimonials}
              booking={
                <p className="rounded-xl border border-dashed border-line px-6 py-16 text-center text-muted">
                  The booking calendar appears here on the live page.
                </p>
              }
            />
            </div>
          </div>
        </div>
      </div>

      <div className="fixed right-4 bottom-4 z-20 xl:hidden">
        <button
          type="button"
          onClick={() => setView(view === "edit" ? "preview" : "edit")}
          className="h-10 rounded-full border border-quant/60 bg-canvas px-5 text-sm text-quant shadow-lg"
        >
          {view === "edit" ? "Preview" : "Back to editor"}
        </button>
      </div>
    </form>
  );
}

/** Upload a PDF to Blob, or type a /brochures/… path. */
function BrochureField({ url, slug, error, onChange }: { url: string; slug: string; error?: string; onChange: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(null);
    const form = new FormData();
    form.set("file", file);
    form.set("slug", slug);
    const result = await uploadCourseBrochure(form);
    setBusy(false);
    if ("url" in result) onChange(result.url);
    else setProblem(result.error);
  }

  return (
    // Not a <Field>: that is a <label>, and the upload control below is a label of its own.
    <div>
      <span className="text-[11px] tracking-[0.22em] text-muted uppercase">Brochure PDF</span>
      <input aria-label="Brochure PDF link" aria-invalid={problem ?? error ? true : undefined} value={url} placeholder="/brochures/cfa-level-1.pdf or upload" onChange={(e) => onChange(e.target.value.trim())} className={FIELD} />
      <span className="mt-2 flex items-center gap-4 text-xs">
        <label className="cursor-pointer text-quant hover:underline">
          <input
            type="file"
            accept="application/pdf"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {busy ? "Uploading…" : "Upload PDF (max 4 MB)"}
        </label>
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-ink">
            Open ↗
          </a>
        )}
      </span>
      {(problem ?? error) ? (
        <span role="alert" className="mt-1.5 block text-xs text-gold">
          {problem ?? error}
        </span>
      ) : (
        <span className="mt-1.5 block text-xs text-muted/80">Blank hides the brochure button. Save to apply.</span>
      )}
    </div>
  );
}
