import type { Metadata } from "next";
import Link from "next/link";

import { siteConfig } from "@/core/config/site";
import { PageHeader } from "@/domains/admin/components/PageHeader";
import { AdminAuth } from "@/domains/admin/server/AdminAuth";
import { SettingsRepository } from "@/domains/settings/server/SettingsRepository";
import { ConnectionPanel, gatewayHealth } from "@/domains/whatsapp/components/ConnectionPanel";
import { MESSAGE_TYPES, MessageType, type MessageTypeId } from "@/domains/whatsapp/components/MessageTypes";
import { OutboxList } from "@/domains/whatsapp/components/OutboxList";
import { WhatsAppOutbox } from "@/domains/whatsapp/server/WhatsAppOutbox";

export const metadata: Metadata = { title: "WhatsApp" };

const NOTICES: Record<string, { text: string; tone: "ok" | "warn" }> = {
  unlinking: { text: "Unlinking: the gateway logs the number out and stops sending.", tone: "ok" },
  "bad-phone": { text: "That number isn't usable. Type it with the country code, e.g. +971 50 123 4567.", tone: "warn" },
  live: { text: "Live: messages now go to students.", tone: "ok" },
  test: { text: "Test mode: every message goes to your test number, marked with who it was for.", tone: "ok" },
  retried: { text: "Queued again.", tone: "ok" },
  resent: { text: "Queued to send again.", tone: "ok" },
  "own-sent": { text: "Queued {n}: they go out a few seconds apart.", tone: "ok" },
  "mock-sent": { text: "Queued {n}. Ticked students who can't open that mock weren't messaged.", tone: "ok" },
  "sent-one": { text: "Queued: it goes out within a minute.", tone: "ok" },
  "not-sent": { text: "Not sent: it's no longer upcoming or issued, or the student has no phone number or replied STOP.", tone: "warn" },
  cancelled: { text: "Cancelled.", tone: "ok" },
  "class-sent": { text: "Queued {n} for the chosen students.", tone: "ok" },
  unedited: { text: "Not sent: the ready-made text needs your own words first.", tone: "warn" },
  nothing: { text: "Nothing queued: the students picked have no phone number, replied STOP, or (for a mock) can't open it.", tone: "warn" },
  nobody: { text: "Not sent: tick at least one student (up to 300) and keep a message.", tone: "warn" },
  dismissed: { text: "Dismissed: nobody is messaged about that post.", tone: "ok" },
  nudged: { text: "Nudge queued for {n} students who haven't handed it in.", tone: "ok" },
  reminded: { text: "Reminder queued.", tone: "ok" },
  "not-reminded": { text: "No reminder: the invoice is paid, or the client has no phone number or replied STOP.", tone: "warn" },
  "not-linked": { text: "Link a number first.", tone: "warn" },
  saved: { text: "Saved: messages queued from now on use this wording.", tone: "ok" },
  reset: { text: "Back to the default wording.", tone: "ok" },
  "bad-text": { text: "Not saved: the wording can't be empty or longer than 1,000 characters.", tone: "warn" },
  "switched-on": { text: "Switched on: the gateway reconnects within a minute. Refresh to see it.", tone: "ok" },
  "switched-off": { text: "Switched off: the gateway disconnects within a minute and nothing is sent. The number stays linked.", tone: "ok" },
};

type Tab = "messages" | "outbox" | "connection";
const TABS: readonly [Tab, string][] = [
  ["messages", "Messages"],
  ["outbox", "Outbox"],
  ["connection", "Connection"],
];

const pill = (active: boolean) =>
  `rounded-md px-3 py-1.5 text-sm ${active ? "bg-quant/15 text-quant" : "text-muted hover:bg-white/5 hover:text-ink"}`;

/** Owner: one tab per message type (wording + send by hand), the outbox, and the connection to the gateway. */
export default async function AdminWhatsAppPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; notice?: string; n?: string }> }) {
  await AdminAuth.requireOwner();
  const query = await searchParams;
  const tab: Tab = TABS.find(([id]) => id === query.tab)?.[0] ?? "messages";
  const type: MessageTypeId = MESSAGE_TYPES.find(([id]) => id === query.type)?.[0] ?? "custom";
  const n = /^\d{1,4}$/.test(query.n ?? "") ? query.n! : "";
  // "Queued 0" is not a success.
  const notice = NOTICES[n === "0" && ["own-sent", "mock-sent", "class-sent", "nudged"].includes(String(query.notice)) ? "nothing" : String(query.notice)];
  const outbox = WhatsAppOutbox.fromEnv();
  if (!outbox) return <p className="text-sm text-gold">DATABASE_URL is not configured.</p>;
  const [link, settings] = await Promise.all([outbox.link(), SettingsRepository.load()]);
  const { healthy, status } = gatewayHealth(link);

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="WhatsApp"
        description="Each message type has its wording and a way to send it by hand. Automatic: session confirmed, a reminder an hour before, invoices and receipts with the PDF, a mock given, one overdue reminder 5 days after the due date, and private-class posts. Quiet 22:00–08:00 (Dubai) except the hour-before reminder and what you send by hand."
      />

      <p className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${healthy ? "bg-quant" : "bg-gold"}`} aria-hidden />
        <span>{status}</span>
        <span className="text-muted">·</span>
        {link.live ? <span className="text-quant">Live</span> : <span className="text-gold">Test mode{link.testPhone ? "" : " (no test number: nothing is sent)"}</span>}
        {tab !== "connection" && (
          <Link href="?tab=connection" className="text-xs text-quant hover:underline">
            Manage
          </Link>
        )}
      </p>

      {notice && (
        <p role="status" className={`mt-3 text-sm ${notice.tone === "ok" ? "text-quant" : "text-gold"}`}>
          {notice.text.replace("{n}", n || "the messages").replace(/ 1 students/, " 1 student")}
        </p>
      )}

      <nav aria-label="WhatsApp sections" className="mt-6 flex gap-1 border-b border-line pb-2">
        {TABS.map(([id, label]) => (
          <Link key={id} href={`?tab=${id}`} aria-current={tab === id ? "page" : undefined} className={pill(tab === id)}>
            {label}
          </Link>
        ))}
      </nav>

      {tab === "messages" && (
        <>
          <nav aria-label="Message types" className="mt-4 flex flex-wrap gap-1">
            {MESSAGE_TYPES.map(([id, label]) => (
              <Link key={id} href={`?type=${id}`} aria-current={type === id ? "page" : undefined} className={pill(type === id)}>
                {label}
              </Link>
            ))}
          </nav>
          <MessageType type={type} settings={settings} link={link} origin={siteConfig.url} />
        </>
      )}
      {tab === "outbox" && <OutboxList messages={await outbox.recent()} />}
      {tab === "connection" && <ConnectionPanel link={link} optedOut={await outbox.optedOut()} />}
    </div>
  );
}
