import Link from "next/link";

import { MockContract } from "../services/MockContract";
import type { MockExam } from "../types";

/** The admin's list of mocks, or of practice sets. */
export function MockTable({ mocks, label }: { mocks: MockExam[]; label: string }) {
  return (
    <div className="mt-8 overflow-x-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="bg-surface text-left text-xs text-muted">
          <tr>
            <th className="px-4 py-3">{label}</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Questions</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {mocks.map((m) => (
            <tr key={m.id}>
              <td className="px-4 py-3">
                <Link href={`/admin/mocks/${m.id}`} className="font-medium hover:text-quant">
                  {m.title}
                </Link>
                {m.source && <span className="block text-xs text-muted">{m.source}</span>}
              </td>
              <td className="px-4 py-3 text-muted">{MockContract.TYPES[m.mockType]}</td>
              <td className="px-4 py-3 font-mono text-xs">
                {m.questionCount} · {m.durationMinutes} min
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                <span className={m.published ? "text-emerald-300" : "text-muted"}>{m.published ? "Published" : "Draft"}</span>
                {m.audience !== "all" && <span className="block text-muted">{m.audience === "course" ? m.courses.join(", ") : "Grant only"}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
