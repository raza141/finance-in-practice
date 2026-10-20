import "katex/dist/katex.min.css";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "@/core/config/site";
import { CourseAnimator } from "@/domains/courses/animations/CourseAnimator";
import type { Instructor } from "@/domains/team/types";
import { Inline, RichText, texToHtml } from "@/domains/journal/components/RichText";

import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Question, QuestionSummary } from "../types";
import { AnswerPicker } from "./AnswerPicker";
import { DifficultyMeter } from "./DifficultyMeter";
import { QuestionCard } from "./QuestionCard";
import { ShareBar } from "./ShareBar";
import { SubscribeForm } from "./SubscribeForm";

/** The formula field is raw LaTeX; tolerate pasted $…$ or $$…$$ around it. */
function formulaHtml(formula: string): string {
  return texToHtml(formula.trim().replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1"), true);
}

/** One cell of the spec strip under the title; linked cells open the Question Bank filtered to that value. */
function Spec({ label, href, note, accent = false, children }: { label: string; href?: string; note?: string; accent?: boolean; children: ReactNode }) {
  const body = (
    <>
      <span className="block text-xs text-muted">{label}</span>
      <span className={`mt-1 block font-semibold ${accent ? "text-gold" : "text-ink"}`}>{children}</span>
      {note && <span className="mt-1 block text-xs leading-snug text-muted">{note}</span>}
    </>
  );
  return (
    <li className="min-w-0">
      {href ? (
        <Link
          href={href}
          title={`More ${label.toLowerCase()} questions like this`}
          className="group block h-full px-4 py-3 transition-colors hover:bg-surface-raised"
        >
          {body}
          <span className="mt-1 block text-xs text-quant opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            See similar
          </span>
        </Link>
      ) : (
        <div className="px-4 py-3">{body}</div>
      )}
    </li>
  );
}

/** "Written by" with photo (or initials), role and a link to the instructor page. */
function Byline({ author, className = "" }: { author: Instructor; className?: string }) {
  const initials = author.name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <p className={`flex items-center gap-3 ${className}`}>
      <span className="relative grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-raised font-serif text-sm font-bold text-ink/90">
        {author.photo ? <Image src={author.photo} alt="" fill sizes="44px" unoptimized={!author.photo.startsWith("/")} className="object-cover" /> : initials}
      </span>
      <span className="text-sm leading-snug">
        <span className="text-muted">Written by </span>
        <Link href="/about" className="font-semibold text-ink hover:text-quant">
          {author.name}
        </Link>
        <span className="block text-muted">{author.role}</span>
      </span>
    </p>
  );
}

function Section({ title, children, tone = "border-line" }: { title: string; children: ReactNode; tone?: string }) {
  return (
    <section className={`border-l-2 pl-4 ${tone}`}>
      <h3 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">{title}</h3>
      <div className="mt-2 text-ink/90">{children}</div>
    </section>
  );
}

/**
 * A CFA question as readers see it: the permanent page, the daily page and the
 * admin preview all render this. Everything is server-rendered (KaTeX included);
 * only AnswerPicker runs in the browser.
 */
export function QuestionView({
  q,
  related,
  banner,
  author,
  preview = false,
}: {
  q: Question;
  related: QuestionSummary[];
  banner?: ReactNode;
  /** The instructor credited on the page; the insight carries their byline. */
  author?: Instructor;
  preview?: boolean;
}) {
  const topic = QuestionTaxonomy.topic(q.topic);
  const letter = QuestionTaxonomy.letter;
  const answer = q.options[q.correct];

  const solution = (
    <div className="mt-6 space-y-6 rounded-xl border border-line bg-surface/70 p-5 sm:p-6">
      <p className="text-lg font-semibold text-emerald-300">
        <span aria-hidden>✓ </span>Correct answer: {letter(q.correct)}. <Inline text={answer.text} />
      </p>
      {q.formula && (
        <Section title="Formula" tone="border-quant/60">
          <div className="overflow-x-auto py-1 text-lg" dangerouslySetInnerHTML={{ __html: formulaHtml(q.formula) }} />
        </Section>
      )}
      {q.solution && (
        <Section title={`Why ${letter(q.correct)} is correct`} tone="border-emerald-400/60">
          <RichText text={q.solution} />
        </Section>
      )}
      {q.imageUrl && (
        <figure>
          <a href={q.imageUrl} target="_blank" rel="noopener" className="block overflow-hidden rounded-lg border border-line bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- Blob image of a handwritten working; shown at its own size */}
            <img src={q.imageUrl} alt={q.imageAlt} loading="lazy" decoding="async" className="mx-auto h-auto max-h-[80vh] w-auto max-w-full" />
          </a>
          <figcaption className="mt-2 text-xs text-muted">Worked solution. Tap to open full size.</figcaption>
        </figure>
      )}
      {q.options.map((o, i) =>
        i !== q.correct && o.why ? (
          <Section key={i} title={`Why ${letter(i)} is incorrect`} tone="border-red-400/50">
            <RichText text={o.why} />
          </Section>
        ) : null,
      )}
      {q.trap && (
        <Section title="Common exam trap" tone="border-gold/60">
          <RichText text={q.trap} />
        </Section>
      )}
    </div>
  );

  return (
    <article className="page-container max-w-6xl pt-10 pb-16 lg:pt-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li>
            <Link href="/cfa/questions" className="hover:text-ink">
              Question Bank
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li>
            <Link href={`/cfa/questions?level=${q.level}`} className="hover:text-ink">
              {QuestionTaxonomy.levelLabel(q.level)}
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li>
            <Link href={`/cfa/questions?level=${q.level}&topic=${q.topic}`} className="hover:text-ink">
              {topic?.name ?? q.topic}
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li aria-current="page" className="text-ink/80">
            {q.title}
          </li>
        </ol>
      </nav>

      {banner}

      <CourseAnimator>
        <h1 className="mt-6 text-3xl leading-tight font-black sm:text-4xl lg:text-[2.625rem]">
          <span data-course-anim="scramble">{q.title}</span>
        </h1>
      </CourseAnimator>

      <ul
        aria-label="About this question"
        className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5 [&>li]:bg-surface"
      >
        <Spec label="Level" href={`/cfa/questions?level=${q.level}`} accent>
          {QuestionTaxonomy.levelLabel(q.level)}
        </Spec>
        <Spec label="Topic" href={`/cfa/questions?level=${q.level}&topic=${q.topic}`}>
          {topic?.name ?? q.topic}
        </Spec>
        {q.subtopic && <Spec label="Subtopic">{q.subtopic}</Spec>}
        <Spec label="Difficulty" href={`/cfa/questions?difficulty=${q.difficulty}`} note={QuestionTaxonomy.difficultyHint(q.difficulty)}>
          <DifficultyMeter difficulty={q.difficulty} label />
        </Spec>
        {q.publishAt && (
          <Spec label="Published">
            <time dateTime={q.publishAt.toISOString()}>
              {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dubai" }).format(q.publishAt)}
            </time>
          </Spec>
        )}
      </ul>

      <section aria-label="Question" className="mt-8 rounded-xl border border-line bg-surface/60 p-5 sm:p-8">
        <p className="font-mono text-[11px] tracking-[0.16em] text-quant">{q.code}</p>
        <RichText text={q.stem} className="mt-3 text-[1.05rem] leading-relaxed text-ink sm:text-lg" />
      </section>

      <div className="mt-6">
        <AnswerPicker
          storageKey={`${preview ? "fip-cfa-preview" : "fip-cfa-q"}:${q.code}`}
          correct={q.correct}
          options={q.options.map((o, i) => ({
            letter: letter(i),
            content: <Inline text={o.text} />,
          }))}
          solution={solution}
          hint={q.formula ? <div dangerouslySetInnerHTML={{ __html: formulaHtml(q.formula) }} /> : undefined}
          paceSeconds={QuestionTaxonomy.examPaceSeconds(q.level)}
          next={
            related[0] && !preview ? (
              <Link
                href={QuestionTaxonomy.path(related[0])}
                className="inline-flex h-12 items-center rounded-md border border-line px-6 text-[15px] font-semibold text-ink transition-colors hover:border-quant/60 hover:text-quant"
              >
                Try another question
              </Link>
            ) : (
              <Link href="/cfa/questions" className="inline-flex h-12 items-center px-2 text-[15px] text-quant hover:underline">
                Back to the Question Bank
              </Link>
            )
          }
        />
      </div>

      {q.insight && (
        <section aria-labelledby="practitioner-insight" className="mt-12 rounded-2xl border border-quant/30 bg-quant/[0.04] p-6 sm:p-8">
          <h2 id="practitioner-insight" className="font-sans text-base font-semibold text-quant">
            Practitioner insight
          </h2>
          <blockquote className="mt-3 max-w-3xl font-serif text-lg leading-[1.75] text-ink sm:text-xl">{q.insight}</blockquote>
          {author && <Byline author={author} className="mt-5" />}
        </section>
      )}

      {q.source && <p className="mt-8 text-sm text-muted">Covers: {q.source}</p>}

      {!preview && <ShareBar url={`${siteConfig.url}${QuestionTaxonomy.path(q)}`} title={q.title} />}

      {related.length > 0 && (
        <nav aria-label="Related questions" className="mt-12">
          <h2 className="font-mono text-[11px] tracking-[0.22em] text-muted uppercase">More questions</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3">
            {related.map((r) => (
              <li key={r.slug}>
                <QuestionCard q={r} />
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section aria-labelledby="qotd-subscribe" className="mt-12 rounded-xl border border-gold/40 bg-gold/5 p-6">
        <h2 id="qotd-subscribe" className="text-xl font-bold">
          Get tomorrow&rsquo;s CFA question
        </h2>
        <p className="mt-1 text-sm text-muted">One exam-style question a day with a full worked solution. Free, unsubscribe anytime.</p>
        <div className="mt-4">
          <SubscribeForm />
        </div>
      </section>

      {author && !q.insight ? (
        <Byline author={author} className="mt-10" />
      ) : (
        <p className="mt-10 text-xs leading-relaxed text-muted/80">Original practice question by {siteConfig.name}.</p>
      )}
    </article>
  );
}
