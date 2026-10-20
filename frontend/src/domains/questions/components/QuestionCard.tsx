import Link from "next/link";

import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { QuestionSummary } from "../types";

/** Library, topic and related-question listings. */
export function QuestionCard({ q }: { q: QuestionSummary }) {
  return (
    <Link href={QuestionTaxonomy.path(q)} className="block h-full rounded-xl border border-line bg-surface p-4 transition-colors hover:border-quant/50">
      <span className="font-mono text-[11px] text-quant">
        {QuestionTaxonomy.levelLabel(q.level)} · {QuestionTaxonomy.topic(q.topic)?.name ?? q.topic}
      </span>
      <span className="mt-1 block font-mono text-[11px] text-muted">Difficulty: {QuestionTaxonomy.difficultyLabel(q.difficulty)}</span>
      <span className="mt-1 block font-semibold text-ink">{q.title}</span>
    </Link>
  );
}
