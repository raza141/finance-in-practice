import type { Metadata } from "next";
import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { setQuestionSwitch } from "@/domains/questions/actions/questions";
import { QuestionRepository } from "@/domains/questions/server/QuestionRepository";
import { QuestionContract } from "@/domains/questions/services/QuestionContract";
import { QuestionTaxonomy } from "@/domains/questions/services/QuestionTaxonomy";
import { PageHeader, PRIMARY_ACTION } from "@/domains/admin/components/PageHeader";

export const metadata: Metadata = { title: "CFA questions" };

function Switch({ name, on, label, detail, owner }: { name: "pages" | "emails"; on: boolean; label: string; detail: string; owner: boolean }) {
  return (
    <form action={setQuestionSwitch} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line p-4">
      <div>
        <p className="text-sm font-semibold">
          {label}: <span className={on ? "text-emerald-300" : "text-muted"}>{on ? "On" : "Off"}</span>
        </p>
        <p className="mt-1 max-w-xl text-xs text-muted">{detail}</p>
      </div>
      {owner && (
        <>
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="on" value={on ? "0" : "1"} />
          <PendingButton pendingLabel="…" className={`h-9 rounded-md px-4 text-sm font-medium ${on ? "border border-line" : "bg-gold text-canvas"}`}>
            {on ? "Turn off" : "Turn on"}
          </PendingButton>
        </>
      )}
    </form>
  );
}

/** The daily CFA question bank: drafts, scheduled and live questions, plus the launch switches. */
export default async function AdminQuestionsPage() {
  const admin = await AdminAuth.require();
  const repo = QuestionRepository.fromEnv();
  if (!repo) {
    return (
      <p role="alert" className="text-sm text-gold">
        Database not configured. Set <code>DATABASE_URL</code> and run <code>npm run db:migrate</code>.
      </p>
    );
  }
  const [questions, switches] = await Promise.all([repo.all(), repo.switches()]);
  const now = new Date();
  const owner = admin.role === "owner";

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="CFA questions"
        description={
          <>
            The newest live question is the Question of the Day at <code>/cfa/question-of-the-day</code>. Schedule questions ahead: each goes live at its time
            (GST) on its own. In each LinkedIn post, link the question&rsquo;s own page (its permanent link, below).
          </>
        }
        actions={
          <Link href="/admin/questions/new" className={PRIMARY_ACTION}>
            New question
          </Link>
        }
      />

      <div className="mt-6 grid gap-3">
        <Switch
          name="pages"
          on={switches.pagesOn}
          owner={owner}
          label="Public pages"
          detail="Off: every /cfa page and the sign-up form return 404 and nothing is in the sitemap. Use Preview to check questions meanwhile."
        />
        <Switch
          name="emails"
          on={switches.emailsOn}
          owner={owner}
          label="Daily email"
          detail="Emails the day's question to sign-ups at 08:00 GST. Also needs the public pages on, RESEND_API_KEY and EMAIL_FROM, and CRON_SECRET in Vercel."
        />
      </div>

      {questions.length === 0 ? (
        <p className="mt-10 text-muted">No questions yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">Question</th>
                <th className="px-4 py-3">Topic</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">
                  <span className="sr-only">Links</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {questions.map((q) => {
                const live = q.publishAt !== null && q.publishAt <= now;
                return (
                  <tr key={q.id}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/questions/${q.id}`} className="font-medium hover:text-quant">
                        {q.title}
                      </Link>
                      <span className="block font-mono text-[11px] text-muted">{q.code}</span>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      L{q.level} · {QuestionTaxonomy.topic(q.topic)?.name ?? q.topic}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {q.publishAt === null ? (
                        <span className="text-muted">Draft</span>
                      ) : (
                        <span className={live ? "text-emerald-300" : "text-quant"}>
                          {live ? "Live" : "Scheduled"} {QuestionContract.toGst(q.publishAt).replace("T", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <Link href={`/admin/questions/${q.id}/preview`} className="text-quant hover:underline">
                        Preview
                      </Link>
                      {live && switches.pagesOn && (
                        <>
                          {" · "}
                          <a href={QuestionTaxonomy.path(q)} target="_blank" rel="noreferrer" className="text-quant hover:underline">
                            Permanent link ↗
                          </a>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
