"use client";

import { useActionState } from "react";

import { FIELD } from "@/domains/admin/components/FormField";
import { PendingButton } from "@/domains/admin/components/PendingButton";

import { addVideo } from "../actions/videos";

/** Paste a YouTube link (Share → Copy) and a title. */
export function VideoForm() {
  const [state, action] = useActionState(addVideo, null);
  return (
    <form action={action} className="grid items-end gap-3 rounded-lg border border-line p-5 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs text-muted">
        YouTube link
        <input name="link" required placeholder="https://youtu.be/…" className={`${FIELD} mt-1`} />
      </label>
      <label className="text-xs text-muted">
        Title
        <input name="title" required maxLength={120} placeholder="e.g. Duration in 10 minutes" className={`${FIELD} mt-1`} />
      </label>
      <PendingButton pendingLabel="Adding…" className="h-10 rounded-md bg-gold px-4 text-sm font-medium text-canvas">
        Add video
      </PendingButton>
      {state && (
        <p role="status" className={`text-sm sm:col-span-3 ${state.ok ? "text-quant" : "text-gold"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
