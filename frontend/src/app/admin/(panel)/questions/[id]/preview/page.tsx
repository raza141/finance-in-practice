import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { QuestionView } from "@/domains/questions/components/QuestionView";
import { QuestionRepository } from "@/domains/questions/server/QuestionRepository";

export const metadata: Metadata = { title: "Preview CFA question", robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The public page as it will look, for drafts, scheduled questions and while the public pages are off. */
export default async function PreviewQuestionPage({ params }: PageProps<"/admin/questions/[id]/preview">) {
  await AdminAuth.require();
  const { id } = await params;
  const repo = QuestionRepository.fromEnv();
  const q = UUID.test(id) ? await repo?.byId(id) : null;
  if (!repo || !q) notFound();
  const related = await repo.related(q);
  return (
    <div>
      <Link href={`/admin/questions/${q.id}`} className="text-sm text-quant hover:underline">
        ← Back to editing
      </Link>
      <div className="mt-4 rounded-xl border border-dashed border-line">
        <QuestionView q={q} related={related} preview />
      </div>
    </div>
  );
}
