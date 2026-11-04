import Link from "next/link";
import type { ReactNode } from "react";

import { siteConfig } from "@/core/config/site";
import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { MockRepository } from "@/domains/mocks/server/MockRepository";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";
import type { BillingSettings, DocumentType, WhatsAppTextKey } from "@/domains/settings/types";

import {
  dismissClassPost,
  nudgeClassPost,
  remindInvoice,
  sendBookingMessage,
  sendClassPost,
  sendDocumentMessage,
  sendMockMessage,
  sendOwnMessage,
} from "../actions/whatsapp";
import { WhatsAppClassPosts } from "../server/WhatsAppClassPosts";
import { WhatsAppOutbox } from "../server/WhatsAppOutbox";
import { WhatsAppScanner } from "../server/WhatsAppScanner";
import { WhatsAppText, type Signature } from "../services/WhatsAppText";
import type { Recipient, WhatsAppLink } from "../types";
import { Composer } from "./Composer";
import { TemplateEditor } from "./TemplateEditor";
import { whatsappTime as time } from "./time";

export type MessageTypeId = "custom" | "booking" | "reminder" | "invoice" | "overdue" | "mock" | "classroom";

export const MESSAGE_TYPES: readonly [MessageTypeId, string][] = [
  ["custom", "Custom"],
  ["booking", "Booking"],
  ["reminder", "Reminder"],
  ["invoice", "Invoice & receipt"],
  ["overdue", "Overdue"],
  ["mock", "Mock"],
  ["classroom", "Classroom"],
];

const BUTTON = "inline-flex h-10 items-center rounded-md px-4 text-sm font-semibold";
const SMALL = "h-8 rounded-md border border-line px-3 text-xs hover:bg-white/5";

function Card({ title, hint, children, id }: { title: string; hint?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="mt-6 scroll-mt-16 rounded-lg border border-line p-5">
      <h2 className="text-lg">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

/** Sample values for each wording's preview: one made-up student, Sara. */
function samples(sign: Signature): Record<string, Record<string, string>> {
  const start = new Date(Date.now() + 26 * 3_600_000);
  const when = WhatsAppText.when(start, WhatsAppText.ZONE);
  const doc = { firstName: "Sara", number: "FIP-INV-0042", amount: "AED 1,500.00", balance: "AED 1,500.00", dueDate: "11 Nov 2026", link: `${siteConfig.url}/invoice/…`, ...sign };
  const session = { firstName: "Sara", session: "CFA Level I", when, where: "https://meet.google.com/abc-defg-hij", link: WhatsAppText.manageLink("sample"), lead: "in about an hour", ...sign };
  return {
    "wa.booking": session,
    "wa.reminder": session,
    "wa.overdue": { ...doc, dueDate: "1 Nov 2026" },
    "wa.mock": { firstName: "Sara", mock: "CFA Level I Mock 3", from: "", link: WhatsAppText.PORTAL_MOCKS, ...sign },
    "wa.class": { firstName: "Sara", kind: "assignment", class: "CFA Level I · Nov 2026", title: "FSA practice set", due: `Due: ${when}`, link: "https://classroom.google.com/…", ...sign },
    "doc.invoice": doc,
    "doc.receipt": doc,
    "doc.quote": doc,
    "doc.credit_note": doc,
  };
}

function Wording({ settings, keys }: { settings: BillingSettings; keys: readonly (WhatsAppTextKey | DocumentType)[] }) {
  const sign = { sender: settings.business.sender, business: settings.business.name };
  const sample = samples(sign);
  return (
    <>
      {keys.map((key) => {
    const isDoc = Object.hasOwn(SettingsContract.DOCUMENT_TYPES, key);
    const field = isDoc ? `doc.${key}` : `wa.${key}`;
    const value = isDoc ? settings.documents[key as DocumentType].whatsapp : settings.whatsapp[key as WhatsAppTextKey];
    return (
      <TemplateEditor
        key={`${field}:${value}`}
        field={field}
        label={isDoc ? `${SettingsContract.DOCUMENT_TYPES[key as DocumentType]} (sent when issued)` : SettingsContract.WHATSAPP_TEXTS[key as WhatsAppTextKey].label}
        placeholders={isDoc ? "{firstName} {number} {amount} {balance} {dueDate} {link} {sender} {business}" : SettingsContract.WHATSAPP_TEXTS[key as WhatsAppTextKey].placeholders}
        value={value}
        sample={sample[field]}
        isDefault={value === SettingsContract.whatsappDefault(field)}
      />
    );
      })}
    </>
  );
}

/** One message type: its automatic wording, then what can be sent by hand. */
export async function MessageType({ type, settings, link, origin }: { type: MessageTypeId; settings: BillingSettings; link: WhatsAppLink; origin: string }) {
  const outbox = WhatsAppOutbox.fromEnv();
  const posts = WhatsAppClassPosts.fromEnv();
  if (!outbox || !posts) return null;
  const sign = { sender: settings.business.sender, business: settings.business.name };
  const audience = async (): Promise<Recipient[]> => (await outbox.reachable()).map(({ id, name, courses, batches }) => ({ id, name, courses, batches }));
  const batch = crypto.randomUUID();
  const notLinked = <p className="text-sm text-gold">Link a number on the Connection tab first.</p>;

  switch (type) {
    case "custom":
      return (
        <>
          <Card id="compose" title="Write a message" hint="Your own message to one student, a course, a batch or everyone. Students without a phone number, or who replied STOP, aren't listed.">
            <Composer students={await audience()} batch={batch} action={sendOwnMessage} starters={WhatsAppText.starters(sign)} />
          </Card>
          <Card title="First message to someone new" hint="Goes once, before the first message, only to students who joined after this number was first linked. Students from before already know the number and never get it. Fixed wording.">
            <p className="rounded-md bg-[#0b141a] p-3 text-xs whitespace-pre-wrap text-[#e9edef]">{WhatsAppText.intro("Sara Khan", sign.sender)}</p>
          </Card>
        </>
      );

    case "booking":
    case "reminder": {
      const scanner = await WhatsAppScanner.create(link, origin);
      const sessions = scanner ? await scanner.upcoming().catch(() => null) : [];
      const which = type === "booking" ? "confirmed" : "reminder";
      return (
        <>
          <Card
            title={type === "booking" ? "Session confirmed" : "Session reminder"}
            hint={
              type === "booking"
                ? "Sent automatically when a session is booked or confirmed. The link opens Cal.com's page for that booking, where they can reschedule or cancel."
                : "Sent automatically an hour before each session booked at least 3 hours ahead, at any hour."
            }
          >
            <Wording settings={settings} keys={[type]} />
          </Card>
          <Card title="Send by hand" hint={`Upcoming sessions in the next 30 days. Sends the ${type === "booking" ? "confirmation" : "reminder"} now, with that session's details.`}>
            {!scanner ? (
              notLinked
            ) : sessions === null ? (
              <p className="text-sm text-gold">Couldn&rsquo;t read the sessions from Cal.com. Refresh to try again.</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-muted">No upcoming sessions with a student who has a phone number.</p>
            ) : (
              <ul className="divide-y divide-line/60 text-sm">
                {sessions.flatMap((s) =>
                  s.students.map((st) => (
                    <li key={`${s.uid}:${st.id}`} className="flex flex-wrap items-center gap-3 py-2.5">
                      <span className="flex-1">
                        <span className="font-semibold">{st.name}</span>
                        <span className="text-muted">
                          {" "}
                          · {s.title} · {time(s.start)}
                        </span>
                      </span>
                      <form action={sendBookingMessage}>
                        <input type="hidden" name="uid" value={s.uid} />
                        <input type="hidden" name="clientId" value={st.id} />
                        <input type="hidden" name="which" value={which} />
                        <PendingButton pendingLabel="Queuing…" className={SMALL}>
                          {type === "booking" ? "Send confirmation" : "Send reminder now"}
                        </PendingButton>
                      </form>
                    </li>
                  )),
                )}
              </ul>
            )}
          </Card>
        </>
      );
    }

    case "invoice": {
      const docs = await posts.recentDocuments();
      return (
        <>
          <Card title="Invoices and receipts" hint="Sent automatically with the PDF when you issue one. Quote and credit-note wording is used by the WhatsApp button on their pages.">
            <Wording settings={settings} keys={["invoice", "receipt", "quote", "credit_note"]} />
          </Card>
          <Card title="Send by hand" hint="Issued in the last 60 days. Sends it again now, with the PDF.">
            {!link.enabledAt ? (
              notLinked
            ) : docs.length === 0 ? (
              <p className="text-sm text-muted">Nothing issued in the last 60 days.</p>
            ) : (
              <ul className="divide-y divide-line/60 text-sm">
                {docs.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <span className="flex-1">
                      <Link href={`/admin/invoices/${d.id}`} className="font-semibold text-quant hover:underline">
                        {d.number}
                      </Link>
                      <span className="text-muted">
                        {" "}
                        · {d.docType} · {d.clientName} · issued {time(d.sentAt)} · {d.lastSent ? `last on WhatsApp ${time(d.lastSent)}` : "not on WhatsApp yet"}
                      </span>
                    </span>
                    <form action={sendDocumentMessage}>
                      <input type="hidden" name="id" value={d.id} />
                      <PendingButton pendingLabel="Queuing…" className={SMALL}>
                        Send on WhatsApp
                      </PendingButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      );
    }

    case "overdue": {
      const overdue = await posts.overdueInvoices();
      return (
        <>
          <Card title="Overdue invoice" hint="Sent automatically once, 5 days after the due date. Any further reminder is your call, below.">
            <Wording settings={settings} keys={["overdue"]} />
          </Card>
          <Card title="Send by hand" hint="Open invoices past their due date.">
            {overdue.length === 0 ? (
              <p className="text-sm text-muted">Nothing overdue.</p>
            ) : (
              <ul className="divide-y divide-line/60 text-sm">
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
            )}
          </Card>
        </>
      );
    }

    case "mock": {
      const mocks = ((await MockRepository.fromEnv()?.all()) ?? []).filter((m) => m.published && m.questionCount > 0);
      return (
        <>
          <Card title="Mock or practice given" hint="Sent automatically when you give a student a mock (or all mocks, or practice) on the Mocks pages. The link opens Exams & mocks in their portal.">
            <Wording settings={settings} keys={["mock"]} />
          </Card>
          <Card title="Send by hand" hint="Announces a published mock. It goes only to the ticked students who can open it; give access on the mock's page first.">
            {!link.enabledAt ? (
              notLinked
            ) : mocks.length === 0 ? (
              <p className="text-sm text-muted">No published mock yet.</p>
            ) : (
              <Composer students={await audience()} batch={batch} action={sendMockMessage}>
                <label className="grid gap-1 text-sm">
                  Mock
                  <select name="mockId" required className={FIELD}>
                    {mocks.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </label>
              </Composer>
            )}
          </Card>
        </>
      );
    }

    case "classroom": {
      const [pending, nudgeable] = await Promise.all([posts.pending(), posts.nudgeable()]);
      return (
        <>
          <Card title="Classroom post" hint="Private classes get it automatically. Course and batch classes wait below for you to choose who gets it.">
            <Wording settings={settings} keys={["class"]} />
          </Card>
          <Card id="posts" title={`Class posts to send (${pending.length})`} hint="Students Classroom assigned the post to are ticked; change the ticks or the wording, then send.">
            {pending.length === 0 && <p className="text-sm text-muted">Nothing waiting.</p>}
            {pending.map((post) => (
              <div key={post.itemId} className="rounded-md border border-line/70 p-4">
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
                      rows={9}
                      maxLength={3000}
                      defaultValue={WhatsAppText.classPost(post.kind, post.classTitle, post.title, post.dueAt, post.link, sign, settings.whatsapp.class)}
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
          </Card>
          <Card id="nudges" title="Nudge who hasn't handed in" hint="Mocks and assignments you sent. The nudge goes only to the students you sent it to who haven't turned it in.">
            {nudgeable.length === 0 ? (
              <p className="text-sm text-muted">Nothing with a due date yet.</p>
            ) : (
              <ul className="divide-y divide-line/60 text-sm">
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
            )}
          </Card>
        </>
      );
    }
  }
}
