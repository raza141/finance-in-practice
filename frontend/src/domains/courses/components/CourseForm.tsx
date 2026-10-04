"use client";

import { startTransition, useActionState, useState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { saveCourse, type CourseFormState } from "../actions/courses";
import { CourseContract, type CourseField } from "../services/CourseContract";
import { CourseFormat } from "../services/CourseFormat";
import type { Course } from "../types";
import { SyllabusEditor } from "./SyllabusEditor";

const noSubscribe = () => () => {};

/** Create or edit a course. Every field is controlled, so a failed save keeps what was typed. */
export function CourseForm({ course }: { course?: Course }) {
  const [state, action, saving] = useActionState<CourseFormState, FormData>(saveCourse, {});
  // False during SSR and hydration: keep fields disabled until React owns them,
  // or text typed before hydration is overwritten by the initial state.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pending = saving || !hydrated;
  const [title, setTitle] = useState(course?.title ?? "");
  const [slug, setSlug] = useState(course?.slug ?? "");
  // New courses derive the slug from the title until the slug is edited by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(course));
  const [summary, setSummary] = useState(course?.summary ?? "");
  const [category, setCategory] = useState<string>(course?.category ?? "");
  const [startDate, setStartDate] = useState(course?.startDate ?? "");
  const [duration, setDuration] = useState(course?.duration ?? "");
  const [price, setPrice] = useState(CourseContract.priceInput(course?.priceMinor ?? null));
  const [currency, setCurrency] = useState(course?.currency ?? "AED");
  const [brochureUrl, setBrochureUrl] = useState(course?.brochureUrl ?? "");
  const [isActive, setIsActive] = useState(course?.isActive ?? false);

  const errors = state.errors ?? {};
  const invalid = (field: CourseField) => (errors[field] ? true : undefined);
  const previewPrice = CourseContract.parsePrice(price);

  // Submit via onSubmit rather than <form action>: React resets a form after an
  // action, which reverts controlled <select>s in the DOM (category, currency)
  // without re-syncing them, so a failed save would lose the selection.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="grid gap-8">
      {course && <input type="hidden" name="id" value={course.id} />}

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Basics</legend>
        <Field label="Title" error={errors.title} className="sm:col-span-2">
          <input
            name="title"
            required
            maxLength={120}
            value={title}
            aria-invalid={invalid("title")}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(CourseContract.slugify(e.target.value));
            }}
            className={FIELD}
          />
        </Field>
        <Field
          label="URL slug"
          error={errors.slug}
          hint={
            <>
              Page address: <span className="text-ink/80">/courses/{slug || "…"}</span>
              {course && course.slug !== slug && " · the old address will stop working"}
            </>
          }
        >
          <input
            name="slug"
            required
            maxLength={80}
            value={slug}
            aria-invalid={invalid("slug")}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            className={FIELD}
          />
        </Field>
        <Field label="Category" error={errors.category}>
          <select
            name="category"
            required
            value={category}
            aria-invalid={invalid("category")}
            onChange={(e) => setCategory(e.target.value)}
            className={FIELD}
          >
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
        <Field label="Summary" error={errors.summary} hint={`${summary.trim().length} / 600 · shown under the title`} className="sm:col-span-2">
          <textarea
            name="summary"
            required
            rows={3}
            maxLength={600}
            value={summary}
            aria-invalid={invalid("summary")}
            onChange={(e) => setSummary(e.target.value)}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </Field>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[11rem_minmax(0,1fr)_10rem_7rem]">
        <legend className="mb-4 text-sm text-quant">Schedule & fee</legend>
        <Field label="Next start" error={errors.startDate} hint="Blank shows “On request”.">
          <input name="startDate" type="date" value={startDate} aria-invalid={invalid("startDate")} onChange={(e) => setStartDate(e.target.value)} className={FIELD} />
        </Field>
        <Field label="Duration" error={errors.duration} hint="e.g. 8 weeks · 16 live sessions">
          <input name="duration" required maxLength={40} value={duration} aria-invalid={invalid("duration")} onChange={(e) => setDuration(e.target.value)} className={FIELD} />
        </Field>
        <Field
          label="Fee"
          error={errors.priceMinor}
          hint={
            previewPrice === "invalid"
              ? "e.g. 4500 or 999.50"
              : `Shows as “${CourseFormat.price({ priceMinor: previewPrice, currency })}”. Blank = on request, 0 = free.`
          }
        >
          <input
            name="price"
            inputMode="decimal"
            placeholder="On request"
            value={price}
            aria-invalid={invalid("priceMinor")}
            onChange={(e) => setPrice(e.target.value)}
            className={`${FIELD} tabular-data`}
          />
        </Field>
        <Field label="Currency" error={errors.currency}>
          <select name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className={FIELD}>
            {CourseContract.CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <fieldset disabled={pending}>
        <legend className="mb-4 text-sm text-quant">Curriculum</legend>
        <SyllabusEditor initial={course?.syllabus ?? []} disabled={pending} />
        {errors.syllabus && (
          <p role="alert" className="mt-2 text-xs text-gold">
            {errors.syllabus}
          </p>
        )}
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Brochure & visibility</legend>
        <Field
          label="Brochure PDF"
          error={errors.brochureUrl}
          hint="Put the PDF in frontend/public/brochures/ and deploy, then enter its path. Blank hides the button."
        >
          <input
            name="brochureUrl"
            placeholder="/brochures/fixed-income.pdf"
            value={brochureUrl}
            aria-invalid={invalid("brochureUrl")}
            onChange={(e) => setBrochureUrl(e.target.value)}
            className={FIELD}
          />
        </Field>
        <label className="flex items-start gap-3 self-center rounded-md border border-line p-4">
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-quant)]"
          />
          <span>
            <span className="block text-sm text-ink">Published</span>
            <span className="mt-1 block text-xs text-muted">
              Visible at /courses/{slug || "…"}. Unpublished courses return “not found”.
            </span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-md bg-gold px-6 font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving…" : course ? "Save changes" : "Create course"}
        </button>
        {state.message && (
          <p role="alert" className="text-sm text-gold">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
