import "katex/dist/katex.min.css";

import type { Metadata } from "next";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { bankTopics } from "@/domains/mocks/components/bankTopics";
import { MockDesignForm } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";

export const metadata: Metadata = { title: "Design a mock" };

/** One step from the bank to a draft: one, several or all books, a number from each and/or questions ticked by hand. */
export default async function DesignMockPage() {
  await AdminAuth.require();
  const repo = MockRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code>.
      </p>
    );
  }
  // ponytail: every question's preview is rendered into the page; past a few thousand, load a topic's list on open.
  const topics = bankTopics((await repo.pool()).filter((q) => !q.retired));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Design a mock"
        description="Choose the books, give each a number of questions and tick any you want for certain. It builds a draft to try and publish."
      />
      <div className="mt-6">
        {topics.length > 0 ? <MockDesignForm topics={topics} /> : <p className="text-muted">The question bank is empty: upload a sheet there first.</p>}
      </div>
    </div>
  );
}
