import Link from "next/link";

import { PendingButton } from "@/domains/admin/components/PendingButton";

import { cancelMessage, resendMessage, retryMessage } from "../actions/whatsapp";
import type { MessageRow } from "../types";
import { whatsappTime as time } from "./time";

const STATUS_TONE: Record<MessageRow["status"], string> = {
  queued: "text-muted",
  sending: "text-quant",
  sent: "text-quant",
  failed: "text-gold",
  unknown: "text-gold",
  cancelled: "text-muted",
  expired: "text-muted",
};

const SMALL = "h-8 rounded-md border border-line px-3 text-xs hover:bg-white/5";

/** The latest messages, with Send again / Resend / Cancel. */
export function OutboxList({ messages }: { messages: readonly MessageRow[] }) {
  return (
      <section id="outbox" className="mt-6 rounded-lg border border-line p-5">
        <h2 className="text-lg">Messages</h2>
        <p className="mt-1 text-sm text-muted">
          The latest 60. &ldquo;Unknown&rdquo;: the gateway stopped mid-send, so it may or may not have arrived; check the chat before retrying.
        </p>
        {messages.length === 0 && <p className="mt-4 text-sm text-muted">No messages yet.</p>}
        <ul className="mt-3 divide-y divide-line/60 text-sm">
          {messages.map((m) => (
            <li key={m.id} className="py-2.5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={`w-20 font-mono text-xs uppercase ${STATUS_TONE[m.status]}`}>{m.status}</span>
                <span className="w-20 text-xs text-muted">{m.kind}</span>
                <Link href={`/admin/clients/${m.clientId}`} className="flex-1 hover:underline">
                  {m.clientName} <span className="text-muted">+{m.phone}</span>
                  {m.sentTo && m.sentTo !== m.phone && <span className="text-gold"> (test → +{m.sentTo})</span>}
                </Link>
                <span className="text-xs text-muted">{m.status === "queued" ? `from ${time(m.notBefore)}` : time(m.sentAt ?? m.createdAt)}</span>
                {(m.status === "failed" || m.status === "unknown" || m.status === "expired") && (
                  <form action={retryMessage}>
                    <input type="hidden" name="id" value={m.id} />
                    <PendingButton pendingLabel="…" className={SMALL}>
                      Send again
                    </PendingButton>
                  </form>
                )}
                {(m.status === "sent" || m.status === "cancelled") && (
                  <form action={resendMessage}>
                    <input type="hidden" name="id" value={m.id} />
                    <PendingButton pendingLabel="…" className={SMALL}>
                      Resend
                    </PendingButton>
                  </form>
                )}
                {m.status === "queued" && (
                  <form action={cancelMessage}>
                    <input type="hidden" name="id" value={m.id} />
                    <PendingButton pendingLabel="…" className={SMALL}>
                      Cancel
                    </PendingButton>
                  </form>
                )}
              </div>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-muted">Message{m.error && <span className="text-gold"> · {m.error}</span>}</summary>
                <p className="mt-1 text-xs whitespace-pre-wrap text-muted">{m.body}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>
  );
}
