import { QuestionTaxonomy } from "../services/QuestionTaxonomy";
import type { Difficulty } from "../types";

/** Three bars, filled one per step of difficulty, so Easy/Medium/Hard read at a glance. */
export function DifficultyMeter({ difficulty, label = false }: { difficulty: Difficulty; label?: boolean }) {
  const filled = QuestionTaxonomy.DIFFICULTIES.indexOf(difficulty) + 1;
  return (
    <span className="inline-flex items-center gap-2" title={`${QuestionTaxonomy.difficultyLabel(difficulty)}: ${QuestionTaxonomy.difficultyHint(difficulty)}`}>
      <span aria-hidden className="inline-flex items-end gap-[3px]">
        {[1, 2, 3].map((n) => (
          <span key={n} className={`w-[4px] rounded-[1px] ${n <= filled ? "bg-gold" : "bg-line"}`} style={{ height: 4 + n * 3 }} />
        ))}
      </span>
      {label ? <span>{QuestionTaxonomy.difficultyLabel(difficulty)}</span> : <span className="sr-only">{QuestionTaxonomy.difficultyLabel(difficulty)}</span>}
    </span>
  );
}
