import { Flag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccountabilityRepository } from "@/domains/accountability/server/AccountabilityRepository";
import { LoopMetrics, type Share } from "@/domains/accountability/services/LoopMetrics";
import { StudyFormat as F } from "@/domains/accountability/services/StudyFormat";
import { StudyProgress } from "@/domains/accountability/services/StudyProgress";
import { TutorBoard, type BoardRow } from "@/domains/accountability/services/TutorBoard";
import { PageHeader, SECONDARY_ACTION } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";

export const metadata: Metadata = { title: "Accountability" };

/** F5: every student with a study goal, whoever needs the tutor first. Owner only. */
export default async function AccountabilityPage() {
  await AdminAuth.requireOwner();
  const repo = AccountabilityRepository.fromEnv();
  if (!repo) return <p role="alert" className="text-sm text-gold">Database not configured.</p>;
  const now = new Date();
  const all = (await repo.facts(null)).map((facts) => StudyProgress.of(facts, now));
  const rows = TutorBoard.rows(all);
  const m = LoopMetrics.of(all);
  const flagged = rows.filter((r) => r.flags.length > 0).length;

  return (
    <div className="max-w-7xl">
      <PageHeader title="Accountability" />
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2">
        <span className={`font-mono text-3xl font-bold tabular-nums ${flagged ? "text-gold" : ""}`}>{flagged}</span>
        <span className="text-sm text-muted">{`of ${F.count(rows.length, "student")} need you`}</span>
      </p>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <Metric label="Weekly active on a 7+ day streak" share={m.streak7} />
        <Metric label="On track" share={m.onTrack} />
        <Metric label="D7 retention" share={m.d7} />
        <Metric label="D30 retention" share={m.d30} />
        <Metric label="Back within 7 days of a broken streak" share={m.returned} />
      </dl>

      {rows.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No study goals yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <StudentRow key={row.progress.goal.clientId} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StudentRow({ row: { progress: p, flags } }: { row: BoardRow }) {
  const band = p.onTrack && F.BAND[p.onTrack.band];
  const planned = p.plan.total ? (p.goal.targetHours * p.plan.elapsed) / p.plan.total : null;
  return (
    <li className="py-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Link href={`/admin/clients/${p.goal.clientId}`} className="font-semibold text-ink hover:text-quant">
            {p.goal.name}
          </Link>
          <p className="text-xs text-muted">{`${p.goal.course}${p.plan.daysLeft === null ? "" : ` · exam in ${F.count(p.plan.daysLeft, "day")}`}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {flags.map((flag) => (
            <span key={flag} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-gold px-2.5 py-1 text-xs text-gold">
              <Flag aria-hidden strokeWidth={1.75} className="size-3.5" />
              {flag}
            </span>
          ))}
          <Link href={`/admin/accountability/${p.goal.clientId}`} className={SECONDARY_ACTION}>
            Check-in
          </Link>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-4 2xl:grid-cols-8">
        <Cell label="On-Track">
          {band ? <span className={`font-semibold ${band.tone}`}>{`${p.onTrack!.score} · ${band.label}`}</span> : "New"}
        </Cell>
        <Cell label="Streak">{F.count(p.streak.current, "day")}</Cell>
        <Cell label="Hours / plan">{planned === null ? F.hours(p.plan.hoursDone) : `${F.hours(p.plan.hoursDone)} / ${F.hours(planned)}`}</Cell>
        <Cell label="Last active">{p.lastActive ? F.day(p.lastActive) : "Never"}</Cell>
        <Cell label="14-day accuracy">{F.percent(p.accuracy)}</Cell>
        <Cell label="Mock trend">{p.mockScores.length ? p.mockScores.map((s) => `${s}%`).join(", ") : "No mocks"}</Cell>
        <Cell label="Weakest 3" wide>
          {p.weakest.length ? p.weakest.map((w) => `${w.name} ${F.percent(w.correct / w.total)}`).join(" · ") : "Not enough answers"}
        </Cell>
      </dl>
    </li>
  );
}

function Cell({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-2" : ""}`}>
      <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{label}</dt>
      <dd className="mt-1 break-words tabular-nums">{children}</dd>
    </div>
  );
}

function Metric({ label, share }: { label: string; share: Share }) {
  return (
    <div className="flex gap-1.5">
      <dt>{label}</dt>
      <dd className="font-mono text-ink tabular-nums">{share.of ? `${share.count}/${share.of}` : "No data"}</dd>
    </div>
  );
}
