import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { deleteQuestion } from "@/domains/questions/actions/questions";
import { QuestionForm } from "@/domains/questions/components/QuestionForm";
import { QuestionRepository } from "@/domains/questions/server/QuestionRepository";
import { QuestionContract } from "@/domains/questions/services/QuestionContract";

export const metadata: Metadata = { title: "Edit CFA question" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditQuestionPage({ params, searchParams }: PageProps<"/admin/questions/[id]">) {
  await AdminAuth.require();
  const { id } = await params;
  const { saved } = await searchParams;
  const q = UUID.test(id) ? await QuestionRepository.fromEnv()?.byId(id) : null;
  if (!q) notFound();
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/admin/questions" className="text-sm text-quant hover:underline">
          ← CFA questions
        </Link>
        <Link href={`/admin/questions/${q.id}/preview`} className="text-sm text-quant hover:underline">
          Preview as readers see it →
        </Link>
      </div>
      <h1 className="mt-4 text-3xl font-normal tracking-tight italic">Edit question</h1>
      <p className="mt-1 mb-6 font-mono text-xs text-muted">{q.code}</p>
      {saved && (
        <p role="status" className="mb-4 text-sm text-quant">
          Saved{q.publishAt ? `. Live from ${QuestionContract.toGst(q.publishAt).replace("T", " ")} GST.` : " as a draft."}
        </p>
      )}
      <QuestionForm question={q} nextSlot={QuestionContract.nextSlot(null)} />
      <form action={deleteQuestion} className="mt-12 border-t border-line pt-6">
        <input type="hidden" name="id" value={q.id} />
        <PendingButton pendingLabel="Deleting…" className="text-sm text-red-300/90 hover:underline">
          Delete this question
        </PendingButton>
        <span className="ml-3 text-xs text-muted">Its URL stops working. Prefer editing a live question over deleting it.</span>
      </form>
    </div>
  );
}
