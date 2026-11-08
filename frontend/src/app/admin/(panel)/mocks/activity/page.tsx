import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader, SECONDARY_ACTION } from "@/domains/admin/components/PageHeader";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { formatDubai } from "@/domains/invoices/components/AdminBits";
import { cancelMockAttempt, markMockAttemptsSeen, setMockPublished } from "@/domains/mocks/actions/mocks";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { MockActivity, type ActivityState } from "@/domains/mocks/services/MockActivity";
import type { MockActivityRow, MockAssignment } from "@/domains/mocks/types";

export const metadata: Metadata = { title: "Mock activity" };

const STATE: Record<ActivityState, [string, string]> = {
  running: ["In progress", "text-quant"],
  paused: ["Paused", "text-gold"],
  time_up: ["Time up, not submitted", "text-gold"],
  completed: ["Finished", "text-emerald-300"],
};
const TABS = [
  ["finished", "Finished"],
  ["progress", "In progress"],
  ["retakes", "Retakes"],
  ["assigned", "Assigned, not started"],
  ["access", "Access ended"],
] as const;
type Tab = (typeof TABS)[number][0];

/** What students are doing with their mocks: who finished, who's mid-way (or stuck over a day), retakes, who hasn't started, and expired access. */
export default async function MockActivityPage({ searchParams }: PageProps<"/admin/mocks/activity">) {
  await AdminAuth.requireOwner();
  const repo = MockRepository.fromEnv();
  if (!repo) return <p role="alert" className="text-sm text-gold">Database not configured.</p>;
  const { tab: raw } = await searchParams;
  const tab: Tab = TABS.some(([t]) => t === raw) ? (raw as Tab) : "finished";

  const [attempts, assigned, expired, nobody] = await Promise.all([repo.activity(), repo.assignments(), repo.expiredGrants(), repo.openToNobody()]);
  const now = new Date();
  const finished = attempts.filter((a) => a.status === "completed");
  const open = attempts.filter((a) => a.status === "in_progress");
  const long = open.filter((a) => MockActivity.isLong(a, now));
  const unseen = finished.filter((a) => !a.seen).length;
  const counts: Record<Tab, number> = {
    finished: finished.length,
    progress: open.length,
    retakes: attempts.filter((a) => a.retake).length,
    assigned: assigned.length,
    access: expired.length + nobody.length,
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Mock activity"
        description="Students' mocks and practice sets (their own drills left out). Finished attempts stay new until you mark them seen."
        actions={
          unseen > 0 && (
            <form action={markMockAttemptsSeen}>
              <button type="submit" className={SECONDARY_ACTION}>
                Mark all {unseen} seen
              </button>
            </form>
          )
        }
      />

      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="New finished" value={unseen} gold={unseen > 0} />
        <Stat label="In progress" value={open.length} />
        <Stat label="Open over a day" value={long.length} gold={long.length > 0} />
        <Stat label="Assigned, not started" value={assigned.length} />
      </ul>

      <nav aria-label="Activity" className="mt-8 flex flex-wrap gap-2 border-b border-line">
        {TABS.map(([t, label]) => (
          <Link
            key={t}
            href={`/admin/mocks/activity?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${t === tab ? "border-quant text-ink" : "border-transparent text-muted hover:text-ink"}`}
          >
            {label} <span className="font-mono text-xs text-muted">{counts[t]}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-4">
        {tab === "finished" && <Attempts rows={finished} now={now} empty="No finished attempts in the last 30 days." />}
        {tab === "progress" && <Attempts rows={[...long, ...open.filter((a) => !long.includes(a))]} now={now} empty="Nobody is part-way through a mock." />}
        {tab === "retakes" && <Attempts rows={attempts.filter((a) => a.retake)} now={now} empty="No retakes in the last 30 days." />}
        {tab === "assigned" && <Assigned rows={assigned} />}
        {tab === "access" && (
          <>
            <p className="text-sm text-muted">Students lose a mock automatically on its end date; these are the grants that ended in the last 60 days.</p>
            {nobody.length > 0 && (
              <section className="mt-4 rounded-xl border border-gold/35 bg-gold/[0.06] p-4">
                <h2 className="text-sm text-ink">Published, but every grant has ended: no student can open them</h2>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {nobody.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-2">
                      <Link href={`/admin/mocks/${m.id}`} className="flex-1 text-quant hover:underline">
                        {m.title}
                      </Link>
                      <form action={setMockPublished}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="on" value="0" />
                        <button type="submit" className={SECONDARY_ACTION}>
                          Unpublish
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <Table empty="No access ended in the last 60 days." head={["Student", "Access to", "Ended"]}>
              {expired.map((g, i) => (
                <tr key={i}>
                  <Td>
                    <ClientLink id={g.clientId} name={g.clientName} />
                  </Td>
                  <Td>{g.target}</Td>
                  <Td mono>{formatDubai(g.endedAt)}</Td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </div>
    </div>
  );
}

function Attempts({ rows, now, empty }: { rows: MockActivityRow[]; now: Date; empty: string }) {
  return (
    <Table empty={empty} head={["Student", "Mock", "Started", "Status", "Score", ""]}>
      {rows.map((a) => {
        const [label, color] = STATE[MockActivity.state(a, now)];
        const isNew = a.status === "completed" && !a.seen;
        return (
          <tr key={a.attemptId} className={isNew ? "bg-gold/[0.06]" : undefined}>
            <Td>
              <ClientLink id={a.clientId} name={a.clientName} />
            </Td>
            <Td>
              {a.mockTitle}
              {a.retake && <span className="ml-2 font-mono text-[10px] text-muted uppercase">retake</span>}
            </Td>
            <Td mono>{formatDubai(a.startedAt)}</Td>
            <Td mono>
              <span className={color}>{label}</span>
              {a.submittedAt && <span className="block text-muted">{formatDubai(a.submittedAt)}</span>}
              {MockActivity.isLong(a, now) && <span className="block text-gold">Open over a day</span>}
            </Td>
            <Td mono>{a.score === null ? "–" : `${a.score}/${a.total} · ${Math.round((a.score / Math.max(a.total, 1)) * 100)}%`}</Td>
            <Td>
              <span className="flex items-center justify-end gap-3">
                <Link href={`/admin/clients/${a.clientId}/mocks/${a.attemptId}`} className="text-xs text-quant hover:underline">
                  Review →
                </Link>
                {a.status === "in_progress" && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-300 hover:underline">Cancel</summary>
                    <form action={cancelMockAttempt} className="mt-2 grid justify-items-end gap-2">
                      <input type="hidden" name="attemptId" value={a.attemptId} />
                      <label className="flex items-center gap-2 text-red-200">
                        <input type="checkbox" required />
                        Delete their answers
                      </label>
                      <PendingButton pendingLabel="Cancelling…" className="text-red-300 hover:underline">
                        Cancel attempt
                      </PendingButton>
                    </form>
                  </details>
                )}
                {isNew && (
                  <form action={markMockAttemptsSeen}>
                    <input type="hidden" name="attemptId" value={a.attemptId} />
                    <button type="submit" className="text-xs text-muted hover:text-ink">
                      Mark seen
                    </button>
                  </form>
                )}
              </span>
            </Td>
          </tr>
        );
      })}
    </Table>
  );
}

function Assigned({ rows }: { rows: MockAssignment[] }) {
  return (
    <Table empty="Every student has started the mocks open to them." head={["Mock", "Student", "Access ends"]}>
      {rows.map((r) => (
        <tr key={`${r.mockId}-${r.clientId}`}>
          <Td>
            <Link href={`/admin/mocks/${r.mockId}`} className="hover:text-quant">
              {r.mockTitle}
            </Link>
          </Td>
          <Td>
            <ClientLink id={r.clientId} name={r.clientName} />
          </Td>
          <Td mono>{r.endsAt ? formatDubai(r.endsAt) : "No end"}</Td>
        </tr>
      ))}
    </Table>
  );
}

function Stat({ label, value, gold = false }: { label: string; value: number; gold?: boolean }) {
  return (
    <li className={`rounded-xl border p-4 ${gold ? "border-gold/35 bg-gold/[0.06]" : "border-line bg-surface"}`}>
      <span className="block text-xs text-muted">{label}</span>
      <span className={`tabular-data mt-1 block text-2xl ${gold ? "text-gold" : ""}`}>{value}</span>
    </li>
  );
}

function Table({ head, empty, children }: { head: string[]; empty: string; children: ReactNode[] }) {
  if (children.length === 0) return <p className="mt-4 text-sm text-muted">{empty}</p>;
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs text-muted">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, mono = false }: { children?: ReactNode; mono?: boolean }) {
  return <td className={`px-4 py-3 align-top ${mono ? "font-mono text-xs" : ""}`}>{children}</td>;
}

function ClientLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/admin/clients/${id}#mocks`} className="text-quant hover:underline">
      {name}
    </Link>
  );
}
