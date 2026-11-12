import { ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/core/components/seo/JsonLd";
import { ButtonLink } from "@/core/components/ui/ButtonLink";
import { StructuredData } from "@/core/seo/StructuredData";
import { QuestionBank } from "@/domains/questions/components/QuestionBank";
import { SubscribeForm } from "@/domains/questions/components/SubscribeForm";
import { QuestionPages } from "@/domains/questions/server/QuestionPages";

export const metadata: Metadata = {
  title: "CFA and FRM Practice Questions with Worked Solutions",
  description:
    "Original CFA and FRM exam-style questions, one a day, each with a step-by-step solution, why the wrong answers are wrong and the common exam trap.",
  alternates: { canonical: "/cfa/questions" },
};

/** The Question Bank: every live question; QuestionBank filters them in the browser. The URL sets the starting filters. */
export default async function QuestionLibraryPage({ searchParams }: PageProps<"/cfa/questions">) {
  const repo = await QuestionPages.repo();
  if (!repo) notFound();
  const raw = await searchParams;
  const pick = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  const [all, latest] = await Promise.all([repo.liveSummaries(), QuestionPages.latest()]);
  const today = latest && all.find((q) => q.code === latest.code);

  return (
    <div className="page-container pt-10 pb-16 lg:pt-12">
      <JsonLd data={StructuredData.graph([StructuredData.breadcrumbs([{ name: "Question Bank", path: "/cfa/questions" }])])} />
      <h1 className="text-4xl leading-tight font-black sm:text-5xl">CFA &amp; FRM Question Bank</h1>
      <p className="mt-4 max-w-2xl text-lg text-muted">
        Original CFA and FRM exam-style questions. Pick an answer, then see the worked solution, why the other answers are wrong and the trap examiners set.
      </p>
      <ButtonLink href="/cfa/diagnostic" variant="secondary" className="mt-6">
        <ClipboardCheck aria-hidden className="size-4" />
        Free 10-question Level I test
      </ButtonLink>

      <QuestionBank
        questions={all}
        today={today ?? null}
        initial={{
          // ?level=frm is the printed link in the FRM Exam Map.
          level: pick("level") === "frm" ? "4" : pick("level"),
          topic: pick("topic"),
          difficulty: pick("difficulty"),
        }}
      />

      <section aria-labelledby="library-subscribe" className="mt-16 max-w-2xl rounded-3xl border border-ink/10 bg-canvas/70 p-6 backdrop-blur sm:p-8">
        <h2 id="library-subscribe" className="text-xl font-bold">
          Get tomorrow&rsquo;s question
        </h2>
        <div className="mt-5">
          <SubscribeForm />
        </div>
      </section>
    </div>
  );
}
