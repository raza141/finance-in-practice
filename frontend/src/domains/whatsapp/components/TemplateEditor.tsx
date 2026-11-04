"use client";

import { useState } from "react";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";
import { SettingsContract } from "@/domains/settings/services/SettingsContract";

import { saveWhatsAppText } from "../actions/whatsapp";

/**
 * One automatic message's wording: edit, see it filled for a sample student as you type, save or go back
 * to the default. `field` is the settings name ("wa.booking", "doc.invoice"); the server checks it.
 */
export function TemplateEditor({
  field,
  label,
  placeholders,
  value,
  sample,
  isDefault,
}: {
  field: string;
  label: string;
  placeholders: string;
  value: string;
  sample: Readonly<Record<string, string>>;
  isDefault: boolean;
}) {
  const [text, setText] = useState(value);
  return (
    <form action={saveWhatsAppText} className="grid gap-3 rounded-md border border-line/70 p-4">
      <input type="hidden" name="field" value={field} />
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <p className="text-xs text-muted">{isDefault ? "Default wording" : "Your wording"}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1 text-sm">
          Wording
          <textarea
            name="text"
            required
            rows={12}
            maxLength={SettingsContract.LIMITS.message}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${FIELD} resize-y font-mono text-xs`}
          />
          <span className="text-xs text-muted">Placeholders: {placeholders}. A line left empty by a placeholder is dropped.</span>
        </label>
        <div className="grid content-start gap-1 text-sm">
          Preview
          <p className="rounded-md bg-[#0b141a] p-3 text-xs leading-relaxed whitespace-pre-wrap text-[#e9edef]">{SettingsContract.fillMessage(text, sample)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <PendingButton pendingLabel="Saving…" className="h-9 rounded-md bg-quant px-4 text-sm font-semibold text-canvas hover:bg-quant/90">
          Save
        </PendingButton>
        {!isDefault && (
          <button name="intent" value="reset" type="submit" formNoValidate className="h-9 rounded-md border border-line px-4 text-sm hover:bg-white/5">
            Reset to default
          </button>
        )}
      </div>
    </form>
  );
}
