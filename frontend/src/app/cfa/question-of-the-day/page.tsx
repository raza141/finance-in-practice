import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { siteConfig } from "@/core/config/site";
import { QuestionView } from "@/domains/questions/components/QuestionView";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";
import { QuestionTaxonomy } from "@/domains/questions/services/QuestionTaxonomy";

// Rolls over to a newly scheduled question within five minutes; saves revalidate at once.
export const revalidate = 300;

const PATH = "/cfa/question-of-the-day";

/** Same content as the permanent page, so the canonical points there: one indexable URL per question. */
export async function generateMetadata(): Promise<Metadata> {
  const q = await QuestionPages.latest();
  if (!q) return { title: "CFA Question of the Day", robots: { index: false } };
  return QuestionPages.metadata(q, { title: `CFA Question of the Day: ${q.title}`, url: `${siteConfig.url}${PATH}` });
}

/** The stable link for a LinkedIn profile or bio: always the latest live question. */
export default async function QuestionOfTheDayPage() {
  const q = await QuestionPages.latest();
  if (!q) notFound();
  const related = (await (await QuestionPages.repo())?.related(q)) ?? [];
  const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" }).format(q.publishAt!);
  return (
    <QuestionView
      q={q}
      related={related}
      banner={
        <p className="mt-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg border border-quant/30 bg-quant/5 px-4 py-2 text-sm">
          <span className="font-mono text-xs tracking-[0.16em] text-quant uppercase">Question of the day · {day}</span>
          <Link href={QuestionTaxonomy.path(q)} className="text-muted underline underline-offset-2 hover:text-ink">
            Permanent link to this question
          </Link>
        </p>
      }
    />
  );
}
