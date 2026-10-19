import type { Metadata } from "next";
import Link from "next/link";

import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { QuestionForm } from "@/domains/questions/components/QuestionForm";
import { QuestionRepository } from "@/domains/questions/server/QuestionRepository";
import { QuestionContract } from "@/domains/questions/services/QuestionContract";

export const metadata: Metadata = { title: "New CFA question" };

export default async function NewQuestionPage() {
  await AdminAuth.require();
  const all = (await QuestionRepository.fromEnv()?.all()) ?? [];
  const last = all.reduce<Date | null>((max, q) => (q.publishAt && (!max || q.publishAt > max) ? q.publishAt : max), null);
  return (
    <div>
      <Link href="/admin/questions" className="text-sm text-quant hover:underline">
        ← CFA questions
      </Link>
      <h1 className="mt-4 mb-6 text-3xl font-normal tracking-tight italic">New question</h1>
      <QuestionForm question={null} nextSlot={QuestionContract.nextSlot(last)} />
    </div>
  );
}
