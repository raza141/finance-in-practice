"use client";

import "katex/dist/katex.min.css";

import { useActionState, useState, type ChangeEvent } from "react";

import { FIELD, Field } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { Inline, RichText, texToHtml } from "@/domains/journal/components/RichText";

import { saveQuestion, uploadSolutionImage } from "../actions/questions";
import { QuestionContract } from "../services/QuestionContract";
import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Difficulty, Question } from "../types";

const MATH_HINT = (
  <>
    Maths: <code>$x^2$</code> inside a sentence, <code>$$…$$</code> on its own lines for a display equation. **bold**, blank line = new
    paragraph, &ldquo;- &rdquo; or &ldquo;1. &rdquo; lines = list. Write <code>\$</code> or USD for a dollar amount.
  </>
);

/** Phone photos are often 5–10 MB (and HEIC on iPhone): redraw at most 2000 px wide as a JPEG before uploading. */
async function shrink(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff"; // transparent PNG scans stay readable on white
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob) throw new Error("encode");
    return new File([blob], "solution.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Draft = Record<string, string>;

function draftOf(q: Question | null, nextSlot: string): Draft {
  const d: Draft = {
    level: String(q?.level ?? 1),
    topic: q?.topic ?? "",
    subtopic: q?.subtopic ?? "",
    difficulty: q?.difficulty ?? "medium",
    title: q?.title ?? "",
    slug: q?.slug ?? "",
    description: q?.description ?? "",
    stem: q?.stem ?? "",
    correct: String(q?.correct ?? 0),
    formula: q?.formula ?? "",
    solution: q?.solution ?? "",
    trap: q?.trap ?? "",
    insight: q?.insight ?? "",
    imageUrl: q?.imageUrl ?? "",
    imageAlt: q?.imageAlt ?? "",
    source: q?.source ?? "",
    status: q?.publishAt ? "publish" : "draft",
    publishAt: q?.publishAt ? QuestionContract.toGst(q.publishAt) : nextSlot,
  };
  for (let i = 0; i < 4; i++) {
    d[`option${i}`] = q?.options[i]?.text ?? "";
    d[`why${i}`] = q?.options[i]?.why ?? "";
  }
  return d;
}

/**
 * Add or edit a question. Paste the question, options and solution; the preview
 * on the right renders the maths exactly as the site will.
 */
export function QuestionForm({ question, nextSlot }: { question: Question | null; nextSlot: string }) {
  const [state, action] = useActionState(saveQuestion, null);
  const [d, setD] = useState<Draft>(() => draftOf(question, nextSlot));
  const [slugTouched, setSlugTouched] = useState(Boolean(question));
  const [upload, setUpload] = useState<string | null>(null);
  const live = Boolean(question?.publishAt && question.publishAt <= new Date());

  const set = (name: string, value: string) => setD((prev) => ({ ...prev, [name]: value }));
  const bind = (name: string) => ({
    name,
    value: d[name],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(name, e.target.value),
  });
  const slug = slugTouched ? d.slug : QuestionContract.slugify(d.title);
  const optionCount = d.option3.trim() ? 4 : 3;

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUpload("Uploading…");
    try {
      const body = new FormData();
      body.set("file", await shrink(file));
      const result = await uploadSolutionImage(body);
      if ("error" in result) return setUpload(result.error);
      set("imageUrl", result.url);
      setUpload(null);
    } catch {
      setUpload("Couldn't read that image. Export it as JPG or PNG and try again.");
    }
  };

  return (
    <form action={action} className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-5">
        {question && <input type="hidden" name="id" value={question.id} />}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Level">
            <select {...bind("level")} className={FIELD}>
              <option value="1">CFA Level I</option>
              <option value="2">CFA Level II</option>
              <option value="3">CFA Level III</option>
            </select>
          </Field>
          <Field label="Topic">
            <select {...bind("topic")} required disabled={live} className={FIELD}>
              <option value="">Choose…</option>
              {QuestionTaxonomy.TOPICS.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name}
                </option>
              ))}
            </select>
            {live && <input type="hidden" name="topic" value={d.topic} />}
          </Field>
          <Field label="Difficulty">
            <select {...bind("difficulty")} className={FIELD}>
              {QuestionTaxonomy.DIFFICULTIES.map((x) => (
                <option key={x} value={x}>
                  {QuestionTaxonomy.difficultyLabel(x)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Subtopic" hint="Shown as a badge, e.g. Interest Rate Risk.">
          <input {...bind("subtopic")} maxLength={80} className={FIELD} />
        </Field>

        <Field label="Title (H1)" hint="Descriptive, keyword-rich: Effective Duration and Convexity: Estimated Bond Price Change.">
          <input {...bind("title")} required maxLength={120} className={FIELD} />
        </Field>
        <Field
          label="URL slug"
          hint={live ? "Locked: the question is live, so its URL must not change." : <>financeinpractice.me/cfa/questions/{d.topic || "topic"}/{slug || "…"}</>}
        >
          <input
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              set("slug", e.target.value);
            }}
            readOnly={live}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            className={`${FIELD} font-mono text-sm`}
          />
        </Field>
        <Field label="Search description" hint="Optional, up to 200 characters. Blank: written from the title.">
          <textarea {...bind("description")} rows={2} maxLength={200} className={FIELD} />
        </Field>

        <Field label="Question" hint={MATH_HINT}>
          <textarea {...bind("stem")} required rows={7} maxLength={5000} className={`${FIELD} font-mono text-sm`} />
        </Field>

        <fieldset className="grid gap-4 rounded-lg border border-line p-4">
          <legend className="px-1 text-[11px] tracking-[0.22em] text-muted uppercase">Options: tick the correct one</legend>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-2">
              <div className="flex items-center gap-3">
                <label className="flex shrink-0 items-center gap-2 font-mono text-sm">
                  <input type="radio" name="correct" value={i} checked={d.correct === String(i)} onChange={() => set("correct", String(i))} className="accent-[#34d399]" />
                  {QuestionTaxonomy.letter(i)}
                </label>
                <input
                  {...bind(`option${i}`)}
                  required={i < 3}
                  maxLength={1000}
                  placeholder={i === 3 ? "Optional (CFA exams use three options)" : `Option ${QuestionTaxonomy.letter(i)}`}
                  aria-label={`Option ${QuestionTaxonomy.letter(i)}`}
                  className={`${FIELD} mt-0`}
                />
              </div>
              {d.correct !== String(i) && (
                <div className="pl-10">
                  <input
                    {...bind(`why${i}`)}
                    maxLength={1000}
                    placeholder={`Why ${QuestionTaxonomy.letter(i)} is incorrect`}
                    aria-label={`Why ${QuestionTaxonomy.letter(i)} is incorrect`}
                    className={`${FIELD} mt-0 text-sm`}
                  />
                </div>
              )}
            </div>
          ))}
        </fieldset>

        <Field label="Formula (LaTeX)" hint={<>e.g. <code>{"\\%\\Delta P \\approx -D \\Delta y + \\tfrac{1}{2} C (\\Delta y)^2"}</code>. No $ needed.</>}>
          <textarea {...bind("formula")} rows={2} maxLength={2000} className={`${FIELD} font-mono text-sm`} />
        </Field>
        <Field label="Why the answer is correct: steps" hint={MATH_HINT}>
          <textarea {...bind("solution")} rows={8} maxLength={10000} className={`${FIELD} font-mono text-sm`} />
        </Field>

        <div className="grid gap-3 rounded-lg border border-line p-4">
          <span className="text-[11px] tracking-[0.22em] text-muted uppercase">Handwritten / diagram solution (optional)</span>
          <input type="hidden" name="imageUrl" value={d.imageUrl} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex h-10 cursor-pointer items-center rounded-md border border-line px-4 text-sm hover:border-quant">
              {d.imageUrl ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/*" onChange={onImage} className="sr-only" />
            </label>
            {d.imageUrl && (
              <button type="button" onClick={() => set("imageUrl", "")} className="text-xs text-red-300/90 hover:underline">
                Remove
              </button>
            )}
            {upload && <span role="status" className="text-xs text-gold">{upload}</span>}
          </div>
          {d.imageUrl && (
            <Field label="Describe it" hint="One sentence for screen readers and Google, e.g. Tree diagram of the duration and convexity effects.">
              <input {...bind("imageAlt")} required maxLength={300} className={FIELD} />
            </Field>
          )}
        </div>

        <Field label="Common exam trap" hint={MATH_HINT}>
          <textarea {...bind("trap")} rows={3} maxLength={2000} className={`${FIELD} text-sm`} />
        </Field>
        <Field label="Practitioner insight" hint={`Optional. Two or three sentences from your own practice: where this shows up at work. Shown with your name, before the reader answers, so don't give the answer away. ${d.insight.length}/400`}>
          <textarea {...bind("insight")} rows={3} maxLength={400} className={`${FIELD} text-sm`} />
        </Field>
        <Field label="Covers (LOS)" hint="Optional, e.g. Fixed Income · LOS: calculate and interpret effective duration and convexity.">
          <input {...bind("source")} maxLength={200} className={FIELD} />
        </Field>

        <fieldset className="grid gap-3 rounded-lg border border-line p-4">
          <legend className="px-1 text-[11px] tracking-[0.22em] text-muted uppercase">Publishing</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="status" value="draft" checked={d.status === "draft"} onChange={() => set("status", "draft")} />
            Draft (not on the site)
          </label>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <input type="radio" name="status" value="publish" checked={d.status === "publish"} onChange={() => set("status", "publish")} />
            Goes live at
            <input type="datetime-local" {...bind("publishAt")} className={`${FIELD} mt-0 w-auto`} />
            <span className="text-muted">GST (UAE time)</span>
          </label>
          <p className="text-xs text-muted">The newest live question is the Question of the Day. Pick a past time to publish now.</p>
        </fieldset>

        <div className="flex flex-wrap items-center gap-4">
          <PendingButton pendingLabel="Saving…" className="h-11 rounded-md bg-gold px-6 text-sm font-semibold text-canvas">
            Save question
          </PendingButton>
          {state && (
            <p role="status" className={`text-sm ${state.ok ? "text-quant" : "text-gold"}`}>
              {state.message}
            </p>
          )}
        </div>
      </div>

      <aside aria-label="Preview" className="content-start xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        <p className="text-[11px] tracking-[0.22em] text-muted uppercase">Preview</p>
        <div className="mt-3 grid gap-5 rounded-xl border border-line bg-surface/60 p-5">
          <ul className="flex flex-wrap gap-2 font-mono text-[11px] tracking-wider uppercase">
            {[QuestionTaxonomy.levelLabel(Number(d.level)), QuestionTaxonomy.topic(d.topic)?.name ?? d.topic, d.subtopic.trim(), QuestionTaxonomy.difficultyLabel(d.difficulty as Difficulty)]
              .filter(Boolean)
              .map((badge, i) => (
                <li key={i} className={`rounded-full border px-3 py-1 ${i === 0 ? "border-gold/60 text-gold" : "border-line text-muted"}`}>
                  {badge}
                </li>
              ))}
          </ul>
          <h2 className="text-2xl font-black">{d.title || "Title"}</h2>
          <RichText text={d.stem || "The question appears here."} className="text-ink" />
          <ol className="grid gap-2">
            {Array.from({ length: optionCount }, (_, i) => (
              <li
                key={i}
                className={`flex gap-3 rounded-lg border-2 px-3 py-2 ${d.correct === String(i) ? "border-emerald-400 bg-emerald-400/10" : "border-line"}`}
              >
                <span className="font-mono text-sm text-muted">{QuestionTaxonomy.letter(i)}</span>
                <span>
                  <Inline text={d[`option${i}`]} />
                </span>
              </li>
            ))}
          </ol>
          {d.formula && <div className="overflow-x-auto text-lg" dangerouslySetInnerHTML={{ __html: texToHtml(d.formula.trim().replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1"), true) }} />}
          {d.solution && <RichText text={d.solution} className="text-ink/90" />}
          {d.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- admin preview of an uploaded Blob image
            <img src={d.imageUrl} alt={d.imageAlt} className="max-h-96 w-auto rounded-lg border border-line bg-white" />
          )}
          {Array.from({ length: optionCount }, (_, i) =>
            i !== Number(d.correct) && d[`why${i}`] ? (
              <div key={i} className="border-l-2 border-red-400/50 pl-3 text-sm">
                <p className="text-muted">Why {QuestionTaxonomy.letter(i)} is incorrect</p>
                <RichText text={d[`why${i}`]} />
              </div>
            ) : null,
          )}
          {d.trap && (
            <div className="border-l-2 border-gold/60 pl-3 text-sm">
              <p className="text-muted">Common exam trap</p>
              <RichText text={d.trap} />
            </div>
          )}
          {d.insight && (
            <div className="border-l-2 border-quant/60 pl-3 text-sm">
              <p className="text-muted">Practitioner insight</p>
              <p>{d.insight}</p>
            </div>
          )}
        </div>
      </aside>
    </form>
  );
}
