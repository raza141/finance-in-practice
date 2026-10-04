"use client";

import { startTransition, useActionState, useSyncExternalStore, type FormEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";

import { saveInstructor, type InstructorFormState } from "../actions/instructors";
import type { InstructorField } from "../services/InstructorContract";
import type { Instructor } from "../types";

const noSubscribe = () => () => {};

/**
 * Create or edit an instructor. Fields are uncontrolled; submitting via
 * onSubmit (not <form action>) stops React resetting them, so a failed save
 * keeps what was typed.
 */
export function InstructorForm({ instructor }: { instructor?: Instructor }) {
  const [state, action, saving] = useActionState<InstructorFormState, FormData>(saveInstructor, {});
  // Disabled until hydrated so text typed before React attaches isn't lost.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const pending = saving || !hydrated;
  const errors = state.errors ?? {};
  const invalid = (field: InstructorField) => (errors[field] ? true : undefined);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => action(data));
  };

  return (
    <form onSubmit={submit} className="grid gap-8">
      {instructor && <input type="hidden" name="id" value={instructor.id} />}

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        <legend className="mb-4 text-sm text-quant">Profile</legend>
        <Field label="Name" error={errors.name}>
          <input name="name" required maxLength={80} defaultValue={instructor?.name} aria-invalid={invalid("name")} className={FIELD} />
        </Field>
        <Field label="Role" error={errors.role} hint="e.g. Instructor · Financial Modeling">
          <input name="role" required maxLength={120} defaultValue={instructor?.role} aria-invalid={invalid("role")} className={FIELD} />
        </Field>
        <Field label="Bio" error={errors.bio} hint="Two or three sentences on teaching style." className="sm:col-span-2">
          <textarea
            name="bio"
            required
            rows={4}
            maxLength={1200}
            defaultValue={instructor?.bio}
            aria-invalid={invalid("bio")}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </Field>
        <Field label="Background" error={errors.background} hint="Industry experience, previous roles." className="sm:col-span-2">
          <textarea
            name="background"
            rows={3}
            maxLength={800}
            defaultValue={instructor?.background}
            aria-invalid={invalid("background")}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </Field>
        <Field label="Education" error={errors.education} hint="One per line.">
          <textarea
            name="education"
            rows={4}
            defaultValue={instructor?.education.join("\n")}
            aria-invalid={invalid("education")}
            className={`${FIELD} resize-y leading-relaxed`}
          />
        </Field>
        <Field label="Highlight tags" error={errors.highlights} hint="Comma-separated, e.g. CFA®, Python, Valuation">
          <input name="highlights" defaultValue={instructor?.highlights.join(", ")} aria-invalid={invalid("highlights")} className={FIELD} />
        </Field>
      </fieldset>

      <fieldset disabled={pending} className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
        <legend className="mb-4 text-sm text-quant">Photo, order & visibility</legend>
        <Field
          label="Photo URL"
          error={errors.photo}
          hint="An https:// image link, or a file in public/team/ such as /team/raza.jpg. Blank shows initials."
        >
          <input name="photo" maxLength={500} placeholder="https://…" defaultValue={instructor?.photo} aria-invalid={invalid("photo")} className={FIELD} />
        </Field>
        <Field label="Order" error={errors.sortOrder} hint="Lowest first.">
          <input
            name="sortOrder"
            type="number"
            step={1}
            defaultValue={instructor?.sortOrder ?? 10}
            aria-invalid={invalid("sortOrder")}
            className={`${FIELD} tabular-data`}
          />
        </Field>
        <label className="flex items-start gap-3 rounded-md border border-line p-4 sm:col-span-2">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={instructor?.isActive ?? false}
            className="mt-0.5 h-4 w-4 accent-[var(--color-quant)]"
          />
          <span>
            <span className="block text-sm text-ink">Published</span>
            <span className="mt-1 block text-xs text-muted">Shown on /about. The first published instructor also appears on the home page.</span>
          </span>
        </label>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-md bg-gold px-6 font-semibold text-canvas transition-colors hover:bg-gold-bright disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving…" : instructor ? "Save changes" : "Create instructor"}
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
