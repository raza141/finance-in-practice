import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ResendClient } from "@/core/email/ResendClient";
import { CheckInForm } from "@/domains/accountability/components/CheckInForm";
import { AccountabilityRepository } from "@/domains/accountability/server/AccountabilityRepository";
import { CheckInEmail } from "@/domains/accountability/services/CheckInEmail";
import { StudyProgress } from "@/domains/accountability/services/StudyProgress";
import { PageHeader, SECONDARY_ACTION } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";

export const metadata: Metadata = { title: "Check-in" };

/** One student's check-in, drafted from today's figures. Nothing goes until Send. */
export default async function CheckInPage({ params }: PageProps<"/admin/accountability/[id]">) {
  await AdminAuth.requireOwner();
  const { id } = await params;
  const [facts] = (await AccountabilityRepository.fromEnv()?.facts(id)) ?? [];
  if (!facts?.goal.live) notFound();
  return (
    <div className="max-w-2xl">
      <PageHeader
        title={`Check-in: ${facts.goal.name}`}
        actions={
          <Link href="/admin/accountability" className={SECONDARY_ACTION}>
            Back
          </Link>
        }
      />
      <div className="mt-6">
        <CheckInForm clientId={id} draft={CheckInEmail.draft(StudyProgress.of(facts))} canSend={ResendClient.fromEnv() !== null} />
      </div>
    </div>
  );
}
