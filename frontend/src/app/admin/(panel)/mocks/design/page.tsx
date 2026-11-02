import "katex/dist/katex.min.css";

import type { Metadata } from "next";

import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { bankTopics } from "@/domains/mocks/components/bankTopics";
import { MockDesignForm, SeenFilter } from "@/domains/mocks/components/MockAdminForms";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockContract } from "@/domains/mocks/services/MockContract";

export const metadata: Metadata = { title: "Design a mock" };

/** One step from the bank to a draft: one, several or all books, a number from each and/or questions ticked by hand. */
export default async function DesignMockPage({ searchParams }: PageProps<"/admin/mocks/design">) {
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
  const { student, level: levelParam } = await searchParams;
  const avoid = MockContract.isUuid(student) ? [student] : [];
  const level = MockContract.level(String(levelParam ?? "")) ?? 1;
  const [pool, students] = await Promise.all([repo.pool(undefined, avoid, level), repo.students()]);
  const topics = bankTopics(pool.filter((q) => !q.retired));

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Design a mock"
        description="Choose the books, give each a number of questions and tick any you want for certain. It builds a draft to try and publish."
      />
      <div className="mt-6">
        <SeenFilter students={students} student={avoid[0] ?? ""} level={level} />
        {level === 2 && (
          <p className="mb-4 text-sm text-muted">
            Level II draws whole item sets: a book&rsquo;s number is filled with complete vignettes, so it can go over by up to three questions. 11 sets (44 questions) a
            session is the exam&rsquo;s size.
          </p>
        )}
        {topics.length > 0 ? (
          <MockDesignForm key={`${avoid[0]}${level}`} topics={topics} avoid={avoid} level={level} />
        ) : (
          <p className="text-muted">
            {avoid.length
              ? "This student has already seen every active question at this level."
              : `No ${MockContract.LEVELS[level]} questions in the bank yet: upload a sheet there first.`}
          </p>
        )}
      </div>
    </div>
  );
}
