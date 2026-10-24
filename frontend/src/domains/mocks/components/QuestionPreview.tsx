import { Inline } from "@/domains/journal/components/RichText";

import { MockContract } from "../services/MockContract";
import { ExhibitText } from "./ExhibitText";

/** A question as students see it, with the answer in green and the explanation: the admin's mock page, bank and editor. */
export function QuestionPreview({ q }: { q: { vignette: string; question: string; options: readonly string[]; correct: string; explanation: string } }) {
  return (
    <div className="grid gap-3">
      {q.vignette && <ExhibitText text={q.vignette} className="rounded-lg border border-line p-3" />}
      <ExhibitText text={q.question} />
      <ol className="grid gap-1">
        {q.options.map((o, i) => (
          <li key={i} className={MockContract.LETTERS[i] === q.correct ? "text-emerald-300" : ""}>
            {MockContract.LETTERS[i]}. <Inline text={o} />
          </li>
        ))}
      </ol>
      {q.explanation && <ExhibitText text={q.explanation} className="text-muted" />}
    </div>
  );
}
