import type { EmailLogEntry, InvoiceStatus } from "../types";

const STATUS_STYLE: Record<InvoiceStatus | "overdue", string> = {
  draft: "border-line text-muted",
  sent: "border-quant/40 text-quant",
  overdue: "border-gold/50 text-gold",
  paid: "border-emerald-400/40 text-emerald-300",
  void: "border-red-400/40 text-red-300",
};

export function StatusBadge({ status }: { status: InvoiceStatus | "overdue" }) {
  return <span className={`rounded border px-2 py-0.5 font-mono text-[10px] tracking-wider uppercase ${STATUS_STYLE[status]}`}>{status}</span>;
}

/** Shown wherever sending is offered while Resend isn't set up. */
export function EmailNotConfigured() {
  return (
    <p role="alert" className="rounded-md border border-gold/40 bg-gold/5 px-4 py-3 text-sm text-gold">
      Email not configured: sending is disabled. Set <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> (and verify the
      domain in Resend). Drafts and the printable invoice link still work.
    </p>
  );
}

const DATE_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" });

export function formatDubai(date: Date): string {
  return DATE_TIME.format(date);
}

export function EmailHistory({ entries }: { entries: readonly EmailLogEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-muted">No emails sent yet.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line text-sm">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5">
          <span className="font-mono text-xs text-muted tabular-nums">{formatDubai(entry.sentAt)}</span>
          <span className="font-mono text-[10px] tracking-wider text-quant uppercase">{entry.kind}</span>
          <span className="min-w-0 flex-1 truncate" title={entry.subject}>
            {entry.subject}
          </span>
          <span className="text-muted">{entry.toEmail}</span>
        </li>
      ))}
    </ul>
  );
}
