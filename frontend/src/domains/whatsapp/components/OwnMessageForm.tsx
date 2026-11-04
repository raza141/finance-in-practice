import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { sendOwnMessage } from "../actions/whatsapp";

/**
 * The owner's own WhatsApp message. With several students, tick who gets it; with one (a client page),
 * it goes to them. {name} becomes each student's first name.
 */
export function OwnMessageForm({ students, back }: { students: readonly { id: string; name: string }[]; back?: string }) {
  const single = students.length === 1;
  return (
    <form action={sendOwnMessage} className="grid gap-3">
      {back && <input type="hidden" name="back" value={back} />}
      {single ? (
        <input type="hidden" name="clientId" value={students[0].id} />
      ) : (
        <fieldset className="max-h-56 overflow-y-auto rounded-md border border-line p-3">
          <legend className="px-1 text-xs text-muted">Send to</legend>
          <div className="grid gap-1.5 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {students.map((s) => (
              <label key={s.id} className="flex items-center gap-2">
                <input type="checkbox" name="clientId" value={s.id} className="accent-[var(--color-quant)]" />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="grid gap-1 text-sm">
        Message
        <textarea name="message" required rows={4} maxLength={3000} placeholder="Hi {name}, …" className={`${FIELD} resize-y`} />
      </label>
      <p className="text-xs text-muted">
        {"{name}"} becomes their first name. Goes out within a minute, at any hour. Anyone new gets the &ldquo;save this number&rdquo; message first.
      </p>
      <PendingButton pendingLabel="Sending…" className="h-10 w-fit rounded-md bg-quant px-4 text-sm font-semibold text-canvas hover:bg-quant/90">
        {single ? `Send to ${students[0].name}` : "Send"}
      </PendingButton>
    </form>
  );
}
