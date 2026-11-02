import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PrintButton } from "@/domains/invoices/components/PrintButton";
import { Inline } from "@/domains/journal/components/RichText";
import { ExhibitText } from "@/domains/mocks/components/ExhibitText";
import { MockPageShell } from "@/domains/mocks/components/MockPageShell";
import { MockSession } from "@/domains/mocks/server/MockSession";
import { MockContract } from "@/domains/mocks/services/MockContract";
import { MockGrader } from "@/domains/mocks/services/MockGrader";
import { StudentAuth } from "@/domains/students/server/StudentAuth";

export const metadata: Metadata = { title: "My mock notes", robots: { index: false, follow: false } };

/** One closed attempt's revision notes on a single page to print: each noted question, its answer and the note. */
export default async function MockNotesPage({ params }: PageProps<"/student/mocks/[attemptId]/notes">) {
  const [student, { attemptId }] = await Promise.all([StudentAuth.current(), params]);
  if (!student) redirect("/student");
  if (!MockContract.isUuid(attemptId)) notFound();
  const repo = MockSession.repo();
  const attempt = await repo.attempt(attemptId, student.id);
  if (!attempt) notFound();
  if (attempt.status !== "completed") redirect(`/student/mocks/${attempt.id}`);
  const [mock, all, responses, seed] = await Promise.all([repo.byId(attempt.mockId), repo.questions(attempt.mockId), repo.responses(attempt.id), repo.seed(attempt)]);
  const notes = new Map(responses.filter((r) => r.notes.trim()).map((r) => [r.questionId, r]));
  const noted = MockGrader.arrange(MockGrader.subset(all, attempt.questionIds), seed).filter((q) => notes.has(q.id));

  return (
    <MockPageShell>
      <article className="mx-auto grid max-w-3xl gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-normal italic">My notes</h1>
            <p className="mt-1 text-muted print:text-black">
              {mock?.title} · {student.name} · {noted.length} question{noted.length === 1 ? "" : "s"}
            </p>
          </div>
          {noted.length > 0 && <PrintButton className="h-10 rounded-md border border-line px-4 text-sm hover:border-quant/60" />}
        </header>
        {noted.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface/60 p-6 text-muted">You didn&rsquo;t write any notes in this attempt. Add them on the results page, under each question.</p>
        ) : (
          <ol className="grid gap-4">
            {noted.map((q) => {
              const mine = notes.get(q.id)!;
              return (
                <li key={q.id} className="break-inside-avoid rounded-2xl border border-line bg-surface/60 p-5 print:border-black/30 print:bg-white">
                  <p className="font-mono text-xs text-quant print:text-black">
                    Question {q.number} · {q.topic} · {mine.selected === q.correct ? "right" : mine.selected ? `you chose ${mine.selected}` : "left blank"}
                  </p>
                  <div className="mt-2">
                    <ExhibitText text={q.question} />
                  </div>
                  <p className="mt-2 text-sm">
                    <span className="font-semibold">Answer {q.correct}:</span> <Inline text={q.options[MockContract.LETTERS.indexOf(q.correct)]} />
                  </p>
                  <p className="mt-3 border-l-2 border-gold/70 pl-3 font-mono text-sm whitespace-pre-wrap print:border-black">{mine.notes}</p>
                </li>
              );
            })}
          </ol>
        )}
      </article>
    </MockPageShell>
  );
}
