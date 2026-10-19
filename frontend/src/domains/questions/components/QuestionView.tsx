import "katex/dist/katex.min.css";

import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "@/core/config/site";
import { Inline, RichText, texToHtml } from "@/domains/journal/components/RichText";

import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Question, QuestionSummary } from "../types";
import { AnswerPicker } from "./AnswerPicker";
import { QuestionCard } from "./QuestionCard";
import { SubscribeForm } from "./SubscribeForm";

/** The formula field is raw LaTeX; tolerate pasted $…$ or $$…$$ around it. */
function formulaHtml(formula: string): string {
  return texToHtml(formula.trim().replace(/^\$\$?([\s\S]*?)\$\$?$/, "$1"), true);
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
export function QuestionView({ q, related, banner, preview = false }: { q: Question; related: QuestionSummary[]; banner?: ReactNode; preview?: boolean }) {
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
    <article className="page-container max-w-3xl pt-10 pb-16 lg:pt-12">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted">
          <li>
            <Link href="/" className="hover:text-ink">
              Home
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li>CFA</li>
          <li aria-hidden>→</li>
          <li>
            <Link href="/cfa/questions" className="hover:text-ink">
              Questions
            </Link>
          </li>
          <li aria-hidden>→</li>
          <li>
            <Link href={`/cfa/questions/${q.topic}`} className="hover:text-ink">
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

      <ul className="mt-6 flex flex-wrap gap-2 font-mono text-[11px] tracking-wider uppercase">
        {[QuestionTaxonomy.levelLabel(q.level), topic?.name ?? q.topic, q.subtopic, QuestionTaxonomy.difficultyLabel(q.difficulty)]
          .filter(Boolean)
          .map((badge, i) => (
            <li key={i} className={`rounded-full border px-3 py-1 ${i === 0 ? "border-gold/60 text-gold" : "border-line text-muted"}`}>
              {badge}
            </li>
          ))}
      </ul>

      <h1 className="mt-4 text-3xl leading-tight font-black sm:text-4xl">{q.title}</h1>

      <section aria-label="Question" className="mt-8 rounded-xl border border-line bg-surface/60 p-5 sm:p-6">
        <p className="font-mono text-[11px] tracking-[0.16em] text-quant">{q.code}</p>
        <RichText text={q.stem} className="mt-3 text-[1.05rem] text-ink" />
      </section>

      <div className="mt-6">
        <AnswerPicker
          storageKey={`${preview ? "fip-cfa-preview" : "fip-cfa-q"}:${q.code}`}
          correct={q.correct}
          options={q.options.map((o, i) => ({ letter: letter(i), content: <Inline text={o.text} /> }))}
          solution={solution}
        />
      </div>

      {q.source && <p className="mt-8 text-xs text-muted">Covers: {q.source}</p>}

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

      <p className="mt-10 text-xs leading-relaxed text-muted/80">
        Original practice question by {siteConfig.name}.
      </p>
    </article>
  );
}
