import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import {
  cancelMessage,
  dismissClassPost,
  linkNumber,
  nudgeClassPost,
  remindInvoice,
  retryMessage,
  sendClassPost,
  setGatewayOn,
  setMode,
  unlinkNumber,
} from "@/domains/whatsapp/actions/whatsapp";
import { AutoRefresh } from "@/domains/whatsapp/components/AutoRefresh";
import { WhatsAppClassPosts } from "@/domains/whatsapp/server/WhatsAppClassPosts";
import { WhatsAppOutbox } from "@/domains/whatsapp/server/WhatsAppOutbox";
import { WhatsAppText } from "@/domains/whatsapp/services/WhatsAppText";
import type { MessageRow } from "@/domains/whatsapp/types";

export const metadata: Metadata = { title: "WhatsApp" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  unlinking: { text: "Unlinking: the gateway logs the number out and stops sending.", tone: "ok" },
  "bad-phone": { text: "That number isn't usable. Type it with the country code, e.g. +971 50 123 4567.", tone: "warn" },
  live: { text: "Live: messages now go to students.", tone: "ok" },
  test: { text: "Test mode: every message goes to your test number, marked with who it was for.", tone: "ok" },
  retried: { text: "Queued again.", tone: "ok" },
  cancelled: { text: "Cancelled.", tone: "ok" },
  "class-sent": { text: "Queued for the chosen students.", tone: "ok" },
  nobody: { text: "Not sent: tick at least one student and keep a message.", tone: "warn" },
  dismissed: { text: "Dismissed: nobody is messaged about that post.", tone: "ok" },
  nudged: { text: "Nudge queued for students who haven't handed it in.", tone: "ok" },
  reminded: { text: "Reminder queued.", tone: "ok" },
  "not-reminded": { text: "No reminder: the invoice is paid, or the client has no phone number or replied STOP.", tone: "warn" },
  "not-linked": { text: "Link a number first.", tone: "warn" },
  "switched-on": { text: "Switched on: the gateway reconnects within a minute. Refresh to see it.", tone: "ok" },
  "switched-off": { text: "Switched off: the gateway disconnects within a minute and nothing is sent. The number stays linked.", tone: "ok" },
};

const STATE_LABEL: Record<string, string> = {
  offline: "Gateway not running",
  connecting: "Connecting",
  pairing: "Waiting for the QR code to be scanned",
  connected: "Connected",
  logged_out: "Logged out",
};

const STATUS_TONE: Record<MessageRow["status"], string> = {
  queued: "text-muted",
  sending: "text-quant",
  sent: "text-quant",
  failed: "text-gold",
  unknown: "text-gold",
  cancelled: "text-muted",
  expired: "text-muted",
};

const BUTTON = "inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold";
const SMALL = "h-8 rounded-md border border-line px-3 text-xs hover:bg-white/5";
const time = (d: Date | null) =>
  d ? new Date(d).toLocaleString("en-GB", { timeZone: WhatsAppText.ZONE, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

/** Owner: the linked WhatsApp number, test/live mode, class posts waiting to be sent, overdue reminders and the outbox. */
export default async function AdminWhatsAppPage({ searchParams }: { searchParams: Promise<{ notice?: string; n?: string }> }) {
  await AdminAuth.requireOwner();
  const query = await searchParams;
  const notice = NOTICES[String(query.notice)];
  const outbox = WhatsAppOutbox.fromEnv();
  const posts = WhatsAppClassPosts.fromEnv();
  if (!outbox || !posts) return <p className="text-sm text-gold">DATABASE_URL is not configured.</p>;
  const [link, messages, pending, nudgeable, overdue, optedOut] = await Promise.all([
    outbox.link(),
    outbox.recent(),
    posts.pending(),
    posts.nudgeable(),
    posts.overdueInvoices(),
    outbox.optedOut(),
  ]);
  const seenAgo = link.seenMinutes;
  const running = seenAgo !== null && seenAgo <= 3;
  const healthy = running && link.gatewayOn && link.state === "connected";
  const status = !running
    ? "Mac not reachable (asleep, off or offline): the gateway starts by itself when it's back"
    : !link.gatewayOn
      ? "Switched off"
      : link.state === "offline"
        ? "Connecting"
        : STATE_LABEL[link.state];
  const qr = link.command === "link" && link.pairingQr ? await QRCode.toString(link.pairingQr, { type: "svg", margin: 2 }) : null;

  return (
    <div className="max-w-5xl">
      <h1 className="text-3xl font-normal tracking-tight italic">WhatsApp</h1>
      <p className="mt-2 text-sm text-muted">
        Sent from the number linked to the gateway on your Mac. Automatic: booking confirmations, reminders the day before and an hour before,
        invoices and receipts (with the PDF), one reminder 5 days after an invoice is due, and posts in private classes. Batch-class posts wait
        below for you to choose who gets them. No messages 22:00–08:00 (Dubai) except the hour-before reminder.
      </p>
      {notice && (
        <p role="status" className={`mt-4 text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
          {notice.text}
        </p>
      )}

      <section className="mt-8 rounded-lg border border-line p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${healthy ? "bg-quant" : "bg-gold"}`} aria-hidden />
          <p className="flex-1 text-sm">
            <span className="font-semibold">{status}</span>
            {link.phone && <span className="text-muted"> · {link.state === "connected" ? "linked" : "last linked"}: +{link.phone}</span>}
            <span className="text-muted"> · last seen {seenAgo === null ? "never" : seenAgo < 1 ? "just now" : `${seenAgo} min ago`}</span>
          </p>
          <form action={setGatewayOn}>
            <input type="hidden" name="on" value={link.gatewayOn ? "0" : "1"} />
            <PendingButton
              pendingLabel="…"
              className={`${BUTTON} ${link.gatewayOn ? "border border-line font-normal hover:bg-white/5" : "bg-quant text-canvas hover:bg-quant/90"}`}
            >
              {link.gatewayOn ? "Turn off" : "Turn on"}
            </PendingButton>
          </form>
          <Link href="/admin/whatsapp" className={SMALL + " inline-flex items-center"}>
            Refresh
          </Link>
        </div>
        {link.command === "link" && (
          <div className="mt-4 rounded-md border border-quant/40 bg-quant/5 p-4 text-sm">
            <AutoRefresh seconds={5} />
            {qr ? (
              <>
                <p>On the phone: WhatsApp → Settings → Linked devices → Link a device, then scan this. It changes every 20 seconds and stops after about 3 minutes.</p>
                {/* eslint-disable-next-line @next/next/no-img-element -- inline SVG data, nothing to optimise */}
                <img src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`} alt="WhatsApp link QR code" className="mt-3 h-64 w-64 rounded-md bg-white" />
              </>
            ) : (
              <p>Waiting for the gateway to show a QR code{running ? "…" : " (your Mac isn't reachable)."}</p>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-end gap-4">
          {link.command !== "link" && (
            <form action={linkNumber}>
              <PendingButton pendingLabel="Asking…" className={`${BUTTON} bg-quant text-canvas hover:bg-quant/90`}>
                {link.state === "connected" ? "Switch to another number" : "Link (show QR code)"}
              </PendingButton>
            </form>
          )}
          {link.state === "connected" && (
            <form action={unlinkNumber}>
              <PendingButton pendingLabel="Unlinking…" className={`${BUTTON} border border-red-400/50 font-normal text-red-300 hover:bg-red-400/10`}>
                Unlink (stop sending)
              </PendingButton>
            </form>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-line p-5">
        <h2 className="text-lg">Mode</h2>
        <p className="mt-1 text-sm text-muted">
          {link.live ? (
            <span className="text-quant">Live: messages go to students.</span>
          ) : (
            <>
              <span className="text-gold">Test mode</span>
              {link.testPhone ? `: everything goes to +${link.testPhone} instead of students.` : ": nothing is sent until you set a test number."}
            </>
          )}
        </p>
        <form action={setMode} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            Test number (yours)
            <input name="testPhone" type="tel" defaultValue={link.testPhone ? `+${link.testPhone}` : ""} placeholder="+971 50 123 4567" className={FIELD} />
          </label>
          <button name="mode" value="test" type="submit" className={`${BUTTON} border border-line font-normal hover:border-quant/60`}>
            Use test mode
          </button>
          <button name="mode" value="live" type="submit" className={`${BUTTON} bg-gold text-canvas hover:bg-gold/90`}>
            Go live
          </button>
        </form>
        {optedOut.length > 0 && (
          <p className="mt-4 text-sm text-muted">
            Replied STOP (never messaged):{" "}
            {optedOut.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ", "}
                <Link href={`/admin/clients/${c.id}`} className="text-quant hover:underline">
                  {c.name}
                </Link>
              </span>
            ))}
            . They can reply START to turn messages back on.
          </p>
        )}
      </section>

      <section id="posts" className="mt-8 rounded-lg border border-line p-5">
        <h2 className="text-lg">Class posts to send ({pending.length})</h2>
        <p className="mt-1 text-sm text-muted">
          New posts in course and batch classes. Students Classroom assigned the post to are ticked; change the ticks or the wording, then send.
          <code className="mx-1">{"{name}"}</code>becomes each student&rsquo;s first name.
        </p>
        {pending.length === 0 && <p className="mt-4 text-sm text-muted">Nothing waiting.</p>}
        {pending.map((post) => (
          <div key={post.itemId} className="mt-5 rounded-md border border-line/70 p-4">
            <p className="text-sm">
              <span className="font-semibold">{post.title}</span>
              <span className="text-muted">
                {" "}
                · {WhatsAppText.KIND_LABEL[post.kind]} · {post.classTitle} · posted {time(post.postedAt)}
                {post.dueAt && ` · due ${time(post.dueAt)}`}
              </span>
            </p>
            <form action={sendClassPost} className="mt-3">
              <input type="hidden" name="itemId" value={post.itemId} />
              <fieldset className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                <legend className="sr-only">Send to</legend>
                {post.recipients.map((r) => (
                  <label key={r.clientId} className="flex items-center gap-2">
                    <input type="checkbox" name="clientId" value={r.clientId} defaultChecked={r.assigned} />
                    {r.name}
                  </label>
                ))}
                {post.recipients.length === 0 && <span className="text-gold">No student in this class matches a client (by email).</span>}
              </fieldset>
              {post.unmatched > 0 && (
                <p className="mt-1 text-xs text-muted">
                  {post.unmatched} {post.unmatched === 1 ? "student" : "students"} in the class didn&rsquo;t match a client: set their Classroom email on
                  their client page.
                </p>
              )}
              <label className="mt-3 block text-sm">
                Message
                <textarea
                  name="message"
                  rows={6}
                  maxLength={3000}
                  defaultValue={WhatsAppText.classPost(post.kind, post.classTitle, post.title, post.dueAt, post.link)}
                  className={FIELD}
                />
              </label>
              <div className="mt-3 flex gap-3">
                <PendingButton pendingLabel="Sending…" className={`${BUTTON} bg-quant text-canvas hover:bg-quant/90`}>
                  Send on WhatsApp
                </PendingButton>
                <button formAction={dismissClassPost} type="submit" className={`${BUTTON} border border-line font-normal hover:border-quant/60`}>
                  Don&rsquo;t send
                </button>
              </div>
            </form>
          </div>
        ))}
      </section>

      <section id="nudges" className="mt-8 rounded-lg border border-line p-5">
        <h2 className="text-lg">Nudge who hasn&rsquo;t handed in</h2>
        <p className="mt-1 text-sm text-muted">Mocks and assignments you sent. The nudge goes only to the students you sent it to who haven&rsquo;t turned it in.</p>
        {nudgeable.length === 0 && <p className="mt-4 text-sm text-muted">Nothing with a due date yet.</p>}
        <ul className="mt-3 divide-y divide-line/60 text-sm">
          {nudgeable.map((post) => (
            <li key={post.itemId} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex-1">
                <span className="font-semibold">{post.title}</span>
                <span className="text-muted">
                  {" "}
                  · {post.classTitle} · due {time(post.dueAt)}
                </span>
              </span>
              <form action={nudgeClassPost}>
                <input type="hidden" name="itemId" value={post.itemId} />
                <PendingButton pendingLabel="Checking…" className={SMALL}>
                  Nudge
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="overdue" className="mt-8 rounded-lg border border-line p-5">
        <h2 className="text-lg">Overdue invoices</h2>
        <p className="mt-1 text-sm text-muted">One reminder goes automatically 5 days after the due date. Any further reminder is your call.</p>
        {overdue.length === 0 && <p className="mt-4 text-sm text-muted">Nothing overdue.</p>}
        <ul className="mt-3 divide-y divide-line/60 text-sm">
          {overdue.map((inv) => (
            <li key={inv.id} className="flex flex-wrap items-center gap-3 py-2.5">
              <span className="flex-1">
                <Link href={`/admin/invoices/${inv.id}`} className="font-semibold text-quant hover:underline">
                  {inv.number}
                </Link>
                <span className="text-muted">
                  {" "}
                  · {inv.clientName} · due {inv.dueDate} · last reminded {time(inv.lastReminded)}
                </span>
              </span>
              <form action={remindInvoice}>
                <input type="hidden" name="id" value={inv.id} />
                <PendingButton pendingLabel="Queuing…" className={SMALL}>
                  Remind on WhatsApp
                </PendingButton>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section id="outbox" className="mt-8 rounded-lg border border-line p-5">
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
    </div>
  );
}
