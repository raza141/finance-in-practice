import { Inline } from "@/domains/journal/components/RichText";

import { MockExhibits } from "../services/MockExhibits";
import type { PoolQuestion } from "../types";
import type { BankTopic } from "./MockAdminForms";
import { QuestionPreview } from "./QuestionPreview";

/** Bank questions as the pickers list them: one group per topic however it was capitalised or spaced, named as first written. */
export function bankTopics(questions: PoolQuestion[]): BankTopic[] {
  const groups = new Map<string, BankTopic>();
  for (const q of questions) {
    const key = q.topic.trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { topic: q.topic.trim(), questions: [] });
    groups.get(key)!.questions.push({
      id: q.id,
      usage: q.usage,
      label: `${q.chapter ? `${q.chapter} · ` : ""}${q.vignette ? "vignette · " : ""}answer ${q.correct}`,
      summary: <Inline text={MockExhibits.parse(q.question).find((p) => p.kind === "text")?.text ?? "(exhibit)"} />,
      preview: <QuestionPreview q={q} />,
    });
  }
  return [...groups.values()];
}
