import "katex/dist/katex.min.css";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { ClientRepository } from "@/domains/invoices/server/ClientRepository";
import { AttemptResults } from "@/domains/mocks/components/AttemptResults";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Mock attempt" };

/** The owner reviews one of a client's mock attempts as the student sees it, notes included; nothing is editable. */
export default async function ClientMockAttemptPage({ params }: PageProps<"/admin/clients/[id]/mocks/[attemptId]">) {
  await AdminAuth.requireOwner();
  const { id, attemptId } = await params;
  if (!MockContract.isUuid(id) || !MockContract.isUuid(attemptId)) notFound();
  const repo = MockRepository.fromEnv();
  const [client, attempt] = await Promise.all([ClientRepository.fromEnv()?.byId(id), repo?.attempt(attemptId, id)]);
  if (!repo || !client || !attempt) notFound();
  const mock = await repo.byId(attempt.mockId);
  if (!mock) notFound();

  return (
    <div className="max-w-5xl">
      <Link href={`/admin/clients/${client.id}#mocks`} className="text-sm text-quant hover:underline">
        ← {client.name}
      </Link>
      <PageHeader title={`${client.name}: ${mock.title}`} description={`${MockContract.TYPES[mock.mockType]}${mock.source ? ` · ${mock.source}` : ""}`} />
      {attempt.status === "in_progress" ? (
        <p className="mt-6 text-sm text-muted">Still in progress: the results show here once they submit or their time runs out.</p>
      ) : (
        <div className="mt-6">
          <AttemptResults repo={repo} attempt={attempt} title={mock.title} readOnly />
        </div>
      )}
    </div>
  );
}
